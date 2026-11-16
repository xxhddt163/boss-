import React, { useState, useEffect, useMemo } from 'react';
import { api, setStoredToken } from '../services/api.ts';
import { User } from '../types.ts';
import { getCurrentServerTime, formatBeijing } from '../utils/time.ts';
import {
  Lock,
  User as UserIcon,
  Phone,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Gamepad2,
} from 'lucide-react';
import emblemImg from '../assets/images/snowman_boss_emblem_1793630816599.jpg';
import bgSnowyVillage from '../assets/images/el_nath_snowy_village_1794783688898.jpg';
import bgWolfTerritory from '../assets/images/el_nath_wolf_territory_1794783690878.jpg';
import bgIceValley from '../assets/images/el_nath_ice_valley_1794783692729.jpg';

interface LoginPortalProps {
  onLoginSuccess: (user: User, pendingInfo?: { count: number; users: User[] }) => void;
}

interface ElNathScene {
  id: string;
  src: string;
  accentGlow: string;
}

const EL_NATH_SCENES: ElNathScene[] = [
  {
    id: 'snowy_village',
    src: bgSnowyVillage,
    accentGlow: 'from-cyan-400/25 via-sky-500/15 to-amber-400/10',
  },
  {
    id: 'wolf_territory',
    src: bgWolfTerritory,
    accentGlow: 'from-sky-400/25 via-cyan-500/15 to-indigo-500/15',
  },
  {
    id: 'ice_valley',
    src: bgIceValley,
    accentGlow: 'from-indigo-400/25 via-amber-400/15 to-cyan-500/15',
  },
];

export const LoginPortal: React.FC<LoginPortalProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [serverTimeStr, setServerTimeStr] = useState<string>('');

  // Randomly select one of the 3 MapleStory El Nath backgrounds on initial load
  const [sceneIndex] = useState<number>(() =>
    Math.floor(Math.random() * EL_NATH_SCENES.length)
  );
  const [imgLoadFailed, setImgLoadFailed] = useState<boolean>(false);

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

  const currentScene = EL_NATH_SCENES[sceneIndex] || EL_NATH_SCENES[0];

  useEffect(() => {
    const updateClock = () => {
      setServerTimeStr(formatBeijing(getCurrentServerTime()));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Gentle snow particles that blend foreground and background together
  const snowParticles = useMemo(
    () =>
      Array.from({ length: 32 }).map((_, i) => ({
        id: i,
        left: `${(i * 31) % 100}%`,
        size: 2 + (i % 4) * 1.4,
        duration: 9 + (i % 7) * 2.2,
        delay: -((i * 1.9) % 14),
        opacity: 0.2 + (i % 5) * 0.12,
      })),
    []
  );

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
      onLoginSuccess(res.user, {
        count: res.pendingUsersCount || 0,
        users: res.pendingUsers || [],
      });
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
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-hidden select-none">
      {/* 1. Full-Bleed Vivid El Nath Painting Layer */}
      <div className="fixed inset-0 z-0 bg-slate-950 overflow-hidden">
        {!imgLoadFailed ? (
          <img
            key={currentScene.id}
            src={currentScene.src}
            alt="El Nath Background"
            referrerPolicy="no-referrer"
            onError={() => setImgLoadFailed(true)}
            className="w-full h-full object-cover object-center transition-all duration-1000 animate-in fade-in"
            style={{ animation: 'elNathSlowZoom 28s ease-in-out infinite alternate' }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-slate-950 via-cyan-950/60 to-indigo-950/80" />
        )}

        {/* Soft atmospheric vignette that preserves the center & left illustration brightness */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/30 via-transparent to-slate-950/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-slate-950/30" />

        {/* Falling Snowflakes across the entire scene */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {snowParticles.map((flake) => (
            <span
              key={flake.id}
              style={{
                left: flake.left,
                width: `${flake.size}px`,
                height: `${flake.size}px`,
                opacity: flake.opacity,
                animation: `elNathSnowfall ${flake.duration}s linear ${flake.delay}s infinite`,
              }}
              className="absolute -top-3 rounded-full bg-white shadow-[0_0_8px_rgba(186,230,253,0.9)]"
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes elNathSnowfall {
          0% {
            transform: translate3d(0, -2vh, 0);
          }
          50% {
            transform: translate3d(16px, 50vh, 0);
          }
          100% {
            transform: translate3d(-10px, 104vh, 0);
          }
        }
        @keyframes elNathSlowZoom {
          0% {
            transform: scale(1.01);
          }
          100% {
            transform: scale(1.07);
          }
        }
      `}</style>

      {/* 2. Integrated Transparent Top HUD Bar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 pt-5 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={emblemImg}
            referrerPolicy="no-referrer"
            alt="Snowman Emblem"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/emblem.jpg';
            }}
            className="w-9 h-9 rounded-xl border border-white/30 object-cover shadow-lg bg-slate-900/50 backdrop-blur-md"
          />
          <span className="text-base sm:text-lg font-extrabold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            SNOWMAN TRACKER
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 text-xs font-mono text-white/90 bg-slate-950/35 backdrop-blur-md border border-white/15 px-3.5 py-1.5 rounded-full tabular-nums shadow-sm">
            <span className="text-sky-200/80 font-sans">北京时间</span>
            <span className="text-white font-semibold">{serverTimeStr || '--:--:--'}</span>
          </div>
        </div>
      </header>

      {/* 3. Main Content Area: Panoramic Scene Showcase on Left + Translucent Ice-Crystal Login Card on Right */}
      <div className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-8">
        {/* Left Panoramic Brand Headline (Unobstructed view of the El Nath artwork) */}
        <div className="hidden lg:flex flex-col justify-end self-end pb-10 max-w-md space-y-3">
          <h1 className="text-3xl xl:text-4xl font-black text-white tracking-tight leading-tight drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]">
            冒险岛驮狼雪人
            <span className="block text-cyan-300 mt-1">全服 60 频道实时监控</span>
          </h1>

          <p className="text-sm text-slate-100/90 leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            实时同步各频道击杀时间、进入刷新窗口与保底倒计时，助您精准蹲守每一只驮狼雪人。
          </p>
        </div>

        {/* Right: Seamless Ice-Crystal Frosted Glass Login Portal */}
        <div className="relative w-full max-w-[410px] select-text">
          {/* Ambient Aurora Glow behind the crystal card */}
          <div
            className={`absolute -inset-1 rounded-3xl bg-gradient-to-br ${currentScene.accentGlow} blur-2xl pointer-events-none transition-all duration-1000`}
          />

          <div className="relative rounded-3xl bg-slate-950/40 backdrop-blur-2xl border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.3)] overflow-hidden">
            {/* Subtle top frost sheen */}
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent" />

            {/* Unified Branding Header */}
            <div className="px-7 pt-7 pb-3 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/25 p-1 mb-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                <img
                  src={emblemImg}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/emblem.jpg';
                  }}
                  alt="驮狼雪人"
                  className="w-full h-full object-cover rounded-xl"
                />
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center justify-center gap-1.5 drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
                <span>冒险岛驮狼雪人</span>
                <span className="text-cyan-300">刷新监控</span>
              </h2>

              {/* Translucent Ice Mode Switch Tabs */}
              <div className="mt-5 grid grid-cols-2 p-1 bg-slate-950/45 backdrop-blur-md rounded-xl border border-white/15 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className={`py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    mode === 'login'
                      ? 'bg-gradient-to-r from-cyan-400 to-sky-400 text-slate-950 shadow-md font-bold'
                      : 'text-slate-200/80 hover:text-white'
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
                  className={`py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    mode === 'register'
                      ? 'bg-gradient-to-r from-cyan-400 to-sky-400 text-slate-950 shadow-md font-bold'
                      : 'text-slate-200/80 hover:text-white'
                  }`}
                >
                  申请注册
                </button>
              </div>
            </div>

            {/* Status Alerts */}
            {errorMsg && (
              <div className="mx-7 mt-2 px-4 py-2.5 rounded-xl bg-rose-950/75 backdrop-blur-md border border-rose-400/40 text-rose-100 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-300" />
                <span className="leading-snug">{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="mx-7 mt-2 px-4 py-2.5 rounded-xl bg-emerald-950/75 backdrop-blur-md border border-emerald-400/40 text-emerald-100 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-300" />
                <span className="leading-snug">{successMsg}</span>
              </div>
            )}

            {/* Form Inputs */}
            <div className="px-7 pt-4 pb-7">
              {mode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-100 font-medium mb-1.5 drop-shadow-xs">
                      登录用户名
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-200/70" />
                      <input
                        type="text"
                        required
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        placeholder="输入登录用户名"
                        className="w-full bg-slate-950/45 hover:bg-slate-950/55 focus:bg-slate-950/65 border border-white/20 rounded-xl pl-10 pr-3.5 py-2.5 text-white placeholder-slate-300/50 focus:outline-none focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300/60 transition-all backdrop-blur-md"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-100 font-medium mb-1.5 drop-shadow-xs">
                      登录密码
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-200/70" />
                      <input
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="输入登录密码"
                        className="w-full bg-slate-950/45 hover:bg-slate-950/55 focus:bg-slate-950/65 border border-white/20 rounded-xl pl-10 pr-3.5 py-2.5 text-white placeholder-slate-300/50 focus:outline-none focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300/60 transition-all backdrop-blur-md"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 bg-gradient-to-r from-cyan-400 via-sky-300 to-cyan-400 hover:from-cyan-300 hover:to-sky-300 text-slate-950 font-black rounded-xl transition-all shadow-[0_8px_24px_rgba(34,211,238,0.35)] active:scale-98 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      {loading ? '正在验证身份...' : '登 录 系 统'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block text-slate-100 font-medium mb-1">登录用户名 *</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-200/70" />
                      <input
                        type="text"
                        required
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="3位以上唯一用户名"
                        className="w-full bg-slate-950/45 focus:bg-slate-950/65 border border-white/20 rounded-xl pl-10 pr-3 py-2 text-white placeholder-slate-300/50 focus:outline-none focus:border-cyan-300 backdrop-blur-md"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-100 font-medium mb-1">登录密码 *</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-200/70" />
                      <input
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="至少5位密码"
                        className="w-full bg-slate-950/45 focus:bg-slate-950/65 border border-white/20 rounded-xl pl-10 pr-3 py-2 text-white placeholder-slate-300/50 focus:outline-none focus:border-cyan-300 backdrop-blur-md"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-100 font-medium mb-1">
                      游戏角色 ID * <span className="text-slate-300/75 font-normal">(用于接单与击杀公开展示)</span>
                    </label>
                    <div className="relative">
                      <Gamepad2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-200/70" />
                      <input
                        type="text"
                        required
                        value={regGameId}
                        onChange={(e) => setRegGameId(e.target.value)}
                        placeholder="如：美团骑手、冰雷法师王"
                        className="w-full bg-slate-950/45 focus:bg-slate-950/65 border border-white/20 rounded-xl pl-10 pr-3 py-2 text-white placeholder-slate-300/50 focus:outline-none focus:border-cyan-300 backdrop-blur-md"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-100 font-medium mb-1">联系电话 *</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-200/70" />
                      <input
                        type="tel"
                        required
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="用于账号审核与身份确认"
                        className="w-full bg-slate-950/45 focus:bg-slate-950/65 border border-white/20 rounded-xl pl-10 pr-3 py-2 text-white placeholder-slate-300/50 focus:outline-none focus:border-cyan-300 backdrop-blur-md"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-100 font-medium mb-1">随机验证码 *</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        value={inputCaptcha}
                        onChange={(e) => setInputCaptcha(e.target.value)}
                        placeholder="输入右侧字符"
                        className="flex-1 bg-slate-950/45 focus:bg-slate-950/65 border border-white/20 rounded-xl px-3.5 py-2 text-white placeholder-slate-300/50 focus:outline-none focus:border-cyan-300 font-mono backdrop-blur-md"
                      />
                      <div
                        onClick={fetchCaptcha}
                        title="点击更换验证码"
                        className="px-3.5 py-2 bg-slate-950/55 hover:bg-slate-900/70 border border-white/20 rounded-xl text-cyan-300 font-mono font-bold tracking-widest cursor-pointer select-none flex items-center gap-1.5 backdrop-blur-md"
                      >
                        <span>{captchaCode || '----'}</span>
                        <RefreshCw className="w-3 h-3 text-slate-300" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 bg-gradient-to-r from-cyan-400 via-sky-300 to-cyan-400 hover:from-cyan-300 hover:to-sky-300 text-slate-950 font-black rounded-xl transition-all shadow-[0_8px_24px_rgba(34,211,238,0.35)] active:scale-98 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      {loading ? '正在提交申请...' : '提 交 注 册 申 请'}
                    </button>
                  </div>

                  <div className="pt-1.5 text-[11px] text-slate-200/80 text-center leading-relaxed">
                    注册成功后为待审核状态，管理员在后台审核通过后即可登录。
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="pb-4" />
    </div>
  );
};
