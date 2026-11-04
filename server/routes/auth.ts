import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { loadDB, scheduleSave, logOperation } from '../db.ts';
import { User } from '../types.ts';

export const authRouter = Router();

// Store temporary captchas: key: sessionId/ip, val: code
const captchas = new Map<string, { code: string; expires: number }>();

authRouter.get('/captcha', (req: Request, res: Response) => {
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const captchaId = `cap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  captchas.set(captchaId, { code, expires: Date.now() + 5 * 60 * 1000 });
  res.json({ captchaId, code });
});

authRouter.post('/register', (req: Request, res: Response) => {
  const { username, password, game_id, phone, captchaId, captchaCode } = req.body;

  if (!username || !password || !game_id || !phone) {
    return res.status(400).json({ error: '请完整填写所有必填字段（用户名、密码、游戏ID、手机号）' });
  }

  if (username.trim().length < 3) {
    return res.status(400).json({ error: '用户名至少需要3个字符' });
  }
  if (password.length < 5) {
    return res.status(400).json({ error: '密码长度至少需要5位' });
  }

  // Validate captcha
  const cap = captchas.get(captchaId);
  if (!cap || cap.expires < Date.now() || cap.code !== captchaCode) {
    return res.status(400).json({ error: '验证码不正确或已过期，请点击验证码刷新后重试' });
  }
  captchas.delete(captchaId);

  const db = loadDB();
  const existingUser = db.users.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase()
  );
  if (existingUser) {
    return res.status(400).json({ error: '该用户名已被注册，请更换用户名' });
  }

  const now = new Date().toISOString();
  const newUser: User = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    username: username.trim(),
    password_hash: bcrypt.hashSync(password, 10),
    nickname: username.trim(),
    game_id: game_id.trim(),
    phone: phone.trim(),
    role: 'player',
    status: 'pending', // 默认待审核
    created_at: now,
    updated_at: now,
  };

  db.users.push(newUser);
  scheduleSave();

  logOperation({
    user_id: newUser.id,
    username: newUser.username,
    action: 'USER_REGISTER',
    new_data: { username: newUser.username, game_id: newUser.game_id, phone: newUser.phone, status: 'pending' },
  });

  return res.json({
    success: true,
    message: '注册申请已提交！账号默认处于“待审核”状态，需等待管理员审核通过后方可登录使用。',
  });
});

authRouter.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }

  const db = loadDB();
  const user = db.users.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase()
  );

  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  if (user.status === 'pending') {
    return res.status(403).json({
      error: '您的账号正在等待管理员审核，审核通过后方可使用',
      status: 'pending',
    });
  }

  if (user.status === 'disabled') {
    return res.status(403).json({
      error: '该账号已被管理员禁用，如有疑问请联系管理员',
      status: 'disabled',
    });
  }

  user.last_login_at = new Date().toISOString();
  scheduleSave();

  logOperation({
    user_id: user.id,
    username: user.username,
    action: 'USER_LOGIN',
  });

  // Simple token payload
  const token = Buffer.from(JSON.stringify({ userId: user.id, ts: Date.now() })).toString('base64');

  let pendingUsersCount = 0;
  let pendingUsers: any[] = [];
  if (user.role === 'admin') {
    pendingUsers = db.users
      .filter((u) => u.status === 'pending')
      .map((u) => ({
        id: u.id,
        username: u.username,
        nickname: u.nickname,
        game_id: u.game_id,
        phone: u.phone,
        role: u.role,
        status: u.status,
        created_at: u.created_at,
      }));
    pendingUsersCount = pendingUsers.length;
  }

  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      game_id: user.game_id,
      phone: user.phone,
      role: user.role,
      status: user.status,
      must_change_password: !!user.must_change_password,
    },
    pendingUsersCount,
    pendingUsers,
  });
});

authRouter.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const token = authHeader.replace(/^Bearer\s+/, '');
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    const db = loadDB();
    const user = db.users.find((u) => u.id === decoded.userId);

    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: '用户不存在或状态异常' });
    }

    let pendingUsersCount = 0;
    let pendingUsers: any[] = [];
    if (user.role === 'admin') {
      pendingUsers = db.users
        .filter((u) => u.status === 'pending')
        .map((u) => ({
          id: u.id,
          username: u.username,
          nickname: u.nickname,
          game_id: u.game_id,
          phone: u.phone,
          role: u.role,
          status: u.status,
          created_at: u.created_at,
        }));
      pendingUsersCount = pendingUsers.length;
    }

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        game_id: user.game_id,
        phone: user.phone,
        role: user.role,
        status: user.status,
        must_change_password: !!user.must_change_password,
      },
      pendingUsersCount,
      pendingUsers,
    });
  } catch {
    return res.status(401).json({ error: '凭证无效' });
  }
});

authRouter.post('/change-password', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: '未登录' });
  }

  const { oldPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 5) {
    return res.status(400).json({ error: '新密码至少需要5位字符' });
  }

  try {
    const token = authHeader.replace(/^Bearer\s+/, '');
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    const db = loadDB();
    const user = db.users.find((u) => u.id === decoded.userId);

    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }

    if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
      return res.status(400).json({ error: '原密码输入不正确' });
    }

    user.password_hash = bcrypt.hashSync(newPassword, 10);
    user.must_change_password = false;
    user.updated_at = new Date().toISOString();
    scheduleSave();

    logOperation({
      user_id: user.id,
      username: user.username,
      action: 'USER_CHANGE_PASSWORD',
    });

    return res.json({ success: true, message: '密码修改成功' });
  } catch {
    return res.status(401).json({ error: '操作失败' });
  }
});
