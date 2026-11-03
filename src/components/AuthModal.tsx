import React, { useState, useEffect } from 'react';
import { api, setStoredToken } from '../services/api.ts';
import { User } from '../types.ts';
import { X, Lock, User as UserIcon, Phone, ShieldCheck, RefreshCw, AlertCircle, Check } from 'lucide-react';

interface AuthModalProps {
  initialMode?: 'login' | 'register' | 'change_password';
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  initialMode = 'login',
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'change_password'>(initialMode);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Login form
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');

  // Register form
  const [regUsername, setRegUsername] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regGameId, setRegGameId] = useState<string>('');
  const [regPhone, setRegPhone] = useState<string>('');
  const [captchaId, setCaptchaId] = useState<string>('');
  const [captchaCode, setCaptchaCode] = useState<string>('');
  const [inputCaptcha, setInputCaptcha] = useState<string>('');

  // Change password form
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');

  // Fetch captcha when in register mode
  const fetchCaptcha = async () => {
    try {
      const res = await api.getCaptcha();
      setCaptchaId(res.captchaId);
      setCaptchaCode(res.code);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (mode === 'register') {
      fetchCaptcha();
    }
  }, [mode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await api.login({
        username: loginUsername,
        password: loginPassword,
      });
      setStoredToken(res.token);
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || '登录失败，请核对用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await api.register({
        username: regUsername,
        password: regPassword,
        game_id: regGameId,
        phone: regPhone,
        captchaId,
        captchaCode: inputCaptcha,
      });
      setSuccessMsg(res.message);
      // Switch back to login after 2 seconds
      setTimeout(() => {
        setMode('login');
        setLoginUsername(regUsername);
        setSuccessMsg('');
      }, 2500);
    } catch (err: any) {
      setErrorMsg(err.message || '注册申请提交失败');
      fetchCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await api.changePassword({ oldPassword, newPassword });
      setSuccessMsg(res.message);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || '修改密码失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header Tabs */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            {mode !== 'change_password' ? (
              <div className="flex p-0.5 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg('');
                  }}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                    mode === 'login' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  账号登录
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMsg('');
                  }}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                    mode === 'register' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  玩家注册
                </button>
              </div>
            ) : (
              <span className="text-base font-bold text-white">修改个人登录密码</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error / Success Alerts */}
        {errorMsg && (
          <div className="px-6 py-2.5 bg-rose-950/80 border-b border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="px-6 py-2.5 bg-emerald-950/80 border-b border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="p-6">
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">登录用户名</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="输入用户名 (默认管理员为 admin)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">登录密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="输入密码 (默认管理员初始密码 admin)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition-colors shadow-md shadow-cyan-500/20 active:scale-95 flex items-center justify-center gap-1.5"
                >
                  {loading ? '正在登录...' : '登 录'}
                </button>
              </div>

              <div className="text-center pt-2 text-slate-500">
                初次使用？点击上方“玩家注册”，审核启用后即可蹲守并记录击杀。
              </div>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">登录用户名 *</label>
                <input
                  type="text"
                  required
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="3位以上唯一用户名"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">登录密码 *</label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="至少5位密码"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  游戏角色 ID * <span className="text-slate-500 font-normal">(用于展示在访问与击杀记录中)</span>
                </label>
                <input
                  type="text"
                  required
                  value={regGameId}
                  onChange={(e) => setRegGameId(e.target.value)}
                  placeholder="如：美团骑手、冰雷法师王"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">联系电话 *</label>
                <input
                  type="tel"
                  required
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="用于账号审核与找回"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">随机验证码 *</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={inputCaptcha}
                    onChange={(e) => setInputCaptcha(e.target.value)}
                    placeholder="请输入右侧验证码"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <div
                    onClick={fetchCaptcha}
                    title="点击刷新验证码"
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-cyan-300 font-mono font-bold tracking-widest cursor-pointer select-none flex items-center gap-1.5"
                  >
                    <span>{captchaCode || '----'}</span>
                    <RefreshCw className="w-3 h-3 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition-colors shadow-md shadow-cyan-500/20 active:scale-95 flex items-center justify-center gap-1.5"
                >
                  {loading ? '正在提交...' : '提交注册申请'}
                </button>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed text-center">
                按需求规范：注册成功后账号处于待审核状态，管理员审核通过后方可访问频道与提交击杀。
              </p>
            </form>
          )}

          {mode === 'change_password' && (
            <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">当前原密码</label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="请输入当前密码"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">设置新密码</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少5位新密码"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition-colors shadow-md shadow-cyan-500/20 active:scale-95"
                >
                  {loading ? '正在保存...' : '确认修改密码'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
