import React, { useState, useEffect } from 'react';
import { api, setStoredToken } from '../services/api.ts';
import { User } from '../types.ts';
import { Lock, User as UserIcon, Phone, RefreshCw, AlertCircle, CheckCircle, ShieldAlert, Sparkles } from 'lucide-react';
import emblemImg from '../assets/images/snowman_boss_emblem_1793630816599.jpg';

interface LoginPortalProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginPortal: React.FC<LoginPortalProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Login form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regGameId, setRegGameId] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [inputCaptcha, setInputCaptcha] = useState('');

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
      onLoginSuccess(res.user);
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

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden">
        {/* Portal Branding Top */}
        <div className="px-6 pt-7 pb-5 text-center border-b border-slate-800/80 bg-slate-950/60">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-800/80 border border-cyan-500/30 p-1 mb-3.5 shadow-lg shadow-cyan-950/50">
            <img
              src={emblemImg}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/emblem.jpg';
              }}
              alt="Snowman Boss"
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center justify-center gap-1.5">
            <span>冒险岛驮狼雪人</span>
            <span className="text-cyan-400">刷新监控</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            仅限受权玩家与管理员访问内部频道数据与击杀监控
          </p>

          {/* Mode Switch Tabs */}
          <div className="mt-5 grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`py-2 rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              账号登录
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`py-2 rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              申请注册
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {errorMsg && (
          <div className="px-6 py-3 bg-rose-950/90 border-b border-rose-800 text-rose-200 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="leading-snug">{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="px-6 py-3 bg-emerald-950/90 border-b border-emerald-800 text-emerald-200 text-xs flex items-center gap-2.5">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="leading-snug">{successMsg}</span>
          </div>
        )}

        {/* Content Area */}
        <div className="p-6">
          {mode === 'login' ? (
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
                    placeholder="输入用户名"
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
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
                    placeholder="输入密码"
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20 active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? '正在验证身份...' : '登 录 系 统'}
                </button>
              </div>

              <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 text-center leading-relaxed">
                提示：新注册账号须经管理员审核开通后方可登录系统。
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">登录用户名 *</label>
                <input
                  type="text"
                  required
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="3位以上唯一用户名"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
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
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  游戏角色 ID * <span className="text-slate-400 font-normal">(用于接单与击杀公开展示)</span>
                </label>
                <input
                  type="text"
                  required
                  value={regGameId}
                  onChange={(e) => setRegGameId(e.target.value)}
                  placeholder="如：美团骑手、冰雷法师王"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">联系电话 *</label>
                <input
                  type="tel"
                  required
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="用于账号审核与身份确认"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
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
                    placeholder="输入右侧字符"
                    className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <div
                    onClick={fetchCaptcha}
                    title="点击更换验证码"
                    className="px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-cyan-300 font-mono font-bold tracking-widest cursor-pointer select-none flex items-center gap-1.5"
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
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20 active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? '正在提交申请...' : '提 交 注 册 申 请'}
                </button>
              </div>

              <div className="pt-2 text-[11px] text-slate-400 text-center leading-relaxed">
                按系统规范：注册成功后为待审核状态，管理员在后台审核通过后即可登录。
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
