import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { Icon, useToast } from '../components/ui.jsx';
import { api } from '../lib/api.js';

const HIGHLIGHTS = [
  ['shield_lock', 'Zero-Data-Retention', 'So\u2018rovlaringiz model provayderida saqlanmaydi'],
  ['neurology', '6 bosqichli tahlil', 'Javob ostida modelning fikrlash izi ochiladi'],
  ['key_vertical', 'FIDO2 va TOTP', 'Ikki bosqichli kirish barcha admin hisoblar uchun'],
  ['monitoring', 'Jonli telemetriya', 'Kechikish, token sarfi va audit zanjiri real vaqtda'],
];

export default function Login() {
  const [mode, setMode] = useState('login');       // login | register | 2fa | forgot | reset
  const [form, setForm] = useState({ email: '', password: '', name: '', department: '', code: '', token: '', next: '' });
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { login, register, verify2fa } = useAuth();
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const nav = useNavigate();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') {
        const res = await login(form.email, form.password);
        if (res.twofa_required) {
          setPending(res);
          setMode('2fa');
          toast(`Tasdiqlash kodi yuborildi (sinov rejimi: ${res.dev_code})`, 'info');
        } else {
          nav('/chat');
        }
      } else if (mode === 'register') {
        await register({ email: form.email, password: form.password, name: form.name, department: form.department });
        nav('/chat');
      } else if (mode === '2fa') {
        await verify2fa(pending.user_id, form.code);
        nav('/chat');
      } else if (mode === 'forgot') {
        const r = await api.post('/auth/forgot', { email: form.email });
        setForm((f) => ({ ...f, token: r.dev_token || '' }));
        setMode('reset');
        toast('Tiklash havolasi yuborildi', 'success');
      } else if (mode === 'reset') {
        await api.post('/auth/reset', { token: form.token, password: form.next });
        toast('Parol yangilandi, endi kiring', 'success');
        setMode('login');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const titles = {
    login: ['Hisobga kirish', 'Korporativ hisobingiz bilan davom eting'],
    register: ['Yangi hisob', 'Birinchi ro\u2018yxatdan o\u2018tgan hisob administrator bo\u2018ladi'],
    '2fa': ['Ikki bosqichli tasdiqlash', `${pending?.method ?? 'TOTP'} orqali yuborilgan 6 xonali kodni kiriting`],
    forgot: ['Parolni tiklash', 'Email manzilingizni kiriting'],
    reset: ['Yangi parol', 'Kamida 12 belgi, katta harf, raqam va maxsus belgi'],
  };

  return (
    <div className="min-h-full grid lg:grid-cols-2 bg-background">
      {/* Chap ustun — brend */}
      <div className="hidden lg:flex flex-col justify-between p-10 bg-surface-container-low border-r border-outline-variant/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Icon name="graph_3" size={22} className="text-primary" />
          </div>
          <div>
            <p className="text-headline-md">NexusAI Enterprise</p>
            <p className="meta">Universal AI Assistant &amp; Security Platform</p>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="text-display-sm mb-3">Korxona darajasidagi sun'iy intellekt va kiberhimoya</h1>
          <p className="text-body-lg text-on-surface-variant">
            Kod tahlili, hujjatlar auditi va xavfsizlik telemetriyasi — bitta ish maydonida,
            har bir amal o'zgartirib bo'lmaydigan jurnalga yozilgan holda.
          </p>

          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map(([icon, title, hint]) => (
              <li key={title} className="flex gap-3">
                <Icon name={icon} size={20} className="text-secondary mt-0.5 shrink-0" />
                <span>
                  <span className="block text-body-md font-medium">{title}</span>
                  <span className="block meta">{hint}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="meta font-mono text-label-sm">v4.2.0 · Toshkent DC-1 · SLA 99.98%</p>
      </div>

      {/* O'ng ustun — forma */}
      <div className="flex flex-col p-6 sm:p-10">
        <div className="flex justify-end">
          <button className="btn-ghost btn-sm px-2" onClick={toggle} aria-label="Mavzuni almashtirish">
            <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} size={20} />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm">
            <div className="lg:hidden flex items-center gap-2.5 mb-8">
              <div className="w-9 h-9 rounded bg-primary/15 border border-primary/30 flex items-center justify-center">
                <Icon name="graph_3" size={20} className="text-primary" />
              </div>
              <p className="text-headline-md">NexusAI Enterprise</p>
            </div>

            <h2 className="text-headline-xl">{titles[mode][0]}</h2>
            <p className="meta mt-1.5 mb-6">{titles[mode][1]}</p>

            <form onSubmit={submit} className="space-y-3.5">
              {mode === 'register' && (
                <>
                  <Field label="To'liq ism" value={form.name} onChange={set('name')} required autoComplete="name" />
                  <Field label="Bo'lim" value={form.department} onChange={set('department')} placeholder="Masalan: R&D" />
                </>
              )}

              {['login', 'register', 'forgot'].includes(mode) && (
                <Field label="Email" type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
              )}

              {['login', 'register'].includes(mode) && (
                <Field
                  label="Parol"
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  hint={mode === 'register' ? 'Kamida 12 belgi, katta harf, raqam va maxsus belgi (@, #, $)' : null}
                />
              )}

              {mode === '2fa' && (
                <Field
                  label="Tasdiqlash kodi"
                  value={form.code}
                  onChange={set('code')}
                  required
                  inputMode="numeric"
                  maxLength={6}
                  className="input font-mono tracking-[0.4em] text-center text-lg"
                  autoComplete="one-time-code"
                />
              )}

              {mode === 'reset' && (
                <>
                  <Field label="Tiklash tokeni" value={form.token} onChange={set('token')} required className="input font-mono text-body-sm" />
                  <Field label="Yangi parol" type="password" value={form.next} onChange={set('next')} required autoComplete="new-password" />
                </>
              )}

              {error && (
                <p className="flex items-start gap-2 text-body-sm text-error bg-error/10 border border-error/30 rounded px-3 py-2">
                  <Icon name="error" size={16} className="mt-0.5 shrink-0" />
                  {error}
                </p>
              )}

              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? 'Bajarilmoqda…' : {
                  login: 'Kirish', register: 'Hisob yaratish', '2fa': 'Tasdiqlash',
                  forgot: 'Havola yuborish', reset: 'Parolni yangilash',
                }[mode]}
              </button>
            </form>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-body-sm">
              {mode === 'login' && (
                <>
                  <button className="text-secondary hover:underline" onClick={() => { setMode('register'); setError(''); }}>
                    Hisob yaratish
                  </button>
                  <button className="text-on-surface-variant hover:text-on-surface" onClick={() => { setMode('forgot'); setError(''); }}>
                    Parolni unutdingizmi?
                  </button>
                </>
              )}
              {mode !== 'login' && (
                <button className="text-secondary hover:underline" onClick={() => { setMode('login'); setError(''); }}>
                  ← Kirish sahifasiga qaytish
                </button>
              )}
            </div>

            {mode === 'login' && (
              <div className="mt-8 panel p-3.5">
                <p className="text-label-sm text-on-surface-variant mb-2">Sinov hisoblari</p>
                <div className="space-y-1 font-mono text-label-sm text-on-surface-variant">
                  <p>admin@nexusai.uz · Admin!2345678 · 2FA</p>
                  <p>dilnoza@nexusai.uz · Dilnoza!2345678</p>
                </div>
                <p className="meta text-label-sm mt-2">
                  Avval <span className="font-mono">npm run seed</span> buyrug'ini bajaring.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, className = 'input', ...props }) {
  return (
    <label className="block">
      <span className="block text-label-md text-on-surface-variant mb-1.5">{label}</span>
      <input className={className} {...props} />
      {hint && <span className="block meta text-label-sm mt-1.5">{hint}</span>}
    </label>
  );
}
