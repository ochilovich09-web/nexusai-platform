import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Card, Icon, Toggle, Modal, useToast, fmt } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();

  const [profile, setProfile] = useState({ name: user.name, department: user.department });
  const [persona, setPersona] = useState(user.settings?.persona ?? '');
  const [pw, setPw] = useState({ current: '', next: '' });
  const [keys, setKeys] = useState([]);
  const [newKey, setNewKey] = useState(null);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api.get('/api-keys').then((d) => setKeys(d.keys)).catch(() => {});
    api.get('/health').then(setHealth).catch(() => {});
  }, []);

  async function saveProfile() {
    try {
      const { user: u } = await api.patch('/auth/me', { ...profile, settings: { ...user.settings, persona } });
      setUser(u);
      toast('Profil saqlandi', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function toggle2fa(enabled) {
    try {
      const { user: u } = await api.post('/auth/me/2fa', { enabled, method: 'totp' });
      setUser(u);
      toast(enabled ? '2FA yoqildi' : "2FA o'chirildi", enabled ? 'success' : 'info');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function changePassword() {
    try {
      await api.post('/auth/me/password', pw);
      setPw({ current: '', next: '' });
      toast('Parol yangilandi', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function createKey() {
    try {
      const r = await api.post('/api-keys', { name: 'CI/CD kaliti' });
      setNewKey(r);
      setKeys(await api.get('/api-keys').then((d) => d.keys));
    } catch (err) { toast(err.message, 'error'); }
  }

  async function revokeKey(id) {
    await api.del(`/api-keys/${id}`);
    setKeys((k) => k.filter((x) => x.id !== id));
    toast('Kalit bekor qilindi', 'success');
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
      <header>
        <h1 className="text-headline-xl">Sozlamalar</h1>
        <p className="meta mt-1">Profil, ko'rinish, AI xatti-harakati va hisob xavfsizligi.</p>
      </header>

      <Card title="Shaxsiy profil">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-label-md text-on-surface-variant mb-1.5">To'liq ism</span>
            <input className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="block text-label-md text-on-surface-variant mb-1.5">Bo'lim</span>
            <input className="input" value={profile.department} onChange={(e) => setProfile({ ...profile, department: e.target.value })} />
          </label>
          <label className="block sm:col-span-2">
            <span className="block text-label-md text-on-surface-variant mb-1.5">Email</span>
            <input className="input font-mono opacity-60" value={user.email} disabled />
          </label>
        </div>
        <button className="btn-primary mt-4" onClick={saveProfile}>O'zgarishlarni saqlash</button>
      </Card>

      <Card title="Ko'rinish">
        <p className="meta mb-3">Interfeys rangi. Tanlov brauzeringizda saqlanadi.</p>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          {[['dark', 'Qorong\u2018i', 'dark_mode'], ['light', 'Yorug\u2018', 'light_mode']].map(([v, label, icon]) => (
            <button
              key={v}
              onClick={() => setTheme(v)}
              className={`panel p-4 flex flex-col items-center gap-2 transition-colors ${theme === v ? 'border-primary bg-primary/10' : 'hover:border-outline'}`}
            >
              <Icon name={icon} size={22} className={theme === v ? 'text-primary' : 'text-on-surface-variant'} />
              <span className="text-body-md">{label}</span>
              {theme === v && <span className="chip-primary">tanlangan</span>}
            </button>
          ))}
        </div>
      </Card>

      <Card title="AI xatti-harakati">
        <label className="block">
          <span className="block text-label-md text-on-surface-variant mb-1.5">Doimiy ko'rsatma</span>
          <textarea
            className="textarea"
            rows={4}
            placeholder="Masalan: javoblarni qisqa yoz, kod misollarini Python'da ber."
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
          />
          <span className="block meta text-label-sm mt-1.5">
            Bu ko'rsatma har bir suhbatda modelning tizim promptiga qo'shiladi.
          </span>
        </label>

        {health && (
          <div className="panel p-3 mt-4 flex items-start gap-2.5">
            <Icon
              name={health.ai.provider === 'demo' ? 'warning' : 'check_circle'}
              size={18}
              className={health.ai.provider === 'demo' ? 'text-warning' : 'text-tertiary'}
            />
            <div>
              <p className="text-body-md">AI provayder: <span className="font-mono">{health.ai.provider}</span></p>
              <p className="meta text-body-sm mt-0.5">
                {health.ai.provider === 'demo'
                  ? "Kalit topilmadi. server/.env faylida ANTHROPIC_API_KEY yoki OPENAI_API_KEY ni to'ldiring."
                  : `Model: ${health.ai.model}`}
              </p>
            </div>
          </div>
        )}

        <button className="btn-primary mt-4" onClick={saveProfile}>Saqlash</button>
      </Card>

      <Card title="Hisob xavfsizligi">
        <Toggle
          checked={!!user.twofa_enabled}
          onChange={toggle2fa}
          label="Ikki bosqichli autentifikatsiya"
          hint="Kirishda 6 xonali tasdiqlash kodi so'raladi"
        />

        <div className="border-t border-outline-variant/40 pt-4 mt-2">
          <p className="text-body-md font-medium mb-3">Parolni o'zgartirish</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <input className="input" type="password" placeholder="Joriy parol" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
            <input className="input" type="password" placeholder="Yangi parol" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />
          </div>
          <p className="meta text-label-sm mt-2">Kamida 12 belgi, katta harf, raqam va maxsus belgi.</p>
          <button className="btn-outline mt-3" onClick={changePassword} disabled={!pw.current || !pw.next}>
            Parolni yangilash
          </button>
        </div>
      </Card>

      <Card
        title="API kalitlar"
        action={<button className="btn-outline btn-sm" onClick={createKey}><Icon name="add" size={16} /> Yangi kalit</button>}
      >
        {!keys.length ? (
          <p className="meta">Kalit yaratilmagan. Kalit tashqi xizmatlarga NexusAI API'siga murojaat qilish imkonini beradi.</p>
        ) : (
          <ul className="divide-y divide-outline-variant/40">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center gap-3 py-3">
                <Icon name="key" size={18} className="text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-body-md truncate">{k.name}</p>
                  <p className="meta text-label-sm font-mono">{k.prefix}…  ·  yaratilgan {fmt.ago(k.created_at)}</p>
                </div>
                <button className="btn-ghost btn-sm px-2 hover:text-error" onClick={() => revokeKey(k.id)} aria-label="Bekor qilish">
                  <Icon name="delete" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Sessiya">
        <p className="meta mb-3">Ushbu qurilmadagi sessiyani yakunlash.</p>
        <button className="btn-danger" onClick={logout}>
          <Icon name="logout" size={18} /> Hisobdan chiqish
        </button>
      </Card>

      <Modal
        open={!!newKey}
        onClose={() => setNewKey(null)}
        title="Yangi API kaliti"
        footer={<button className="btn-primary" onClick={() => setNewKey(null)}>Nusxa oldim</button>}
      >
        <p className="meta mb-3">Bu kalit faqat hozir ko'rsatiladi. Nusxa olib xavfsiz joyda saqlang.</p>
        <div className="panel p-3 font-mono text-code-md break-all select-all">{newKey?.key}</div>
        <button
          className="btn-outline btn-sm mt-3"
          onClick={() => { navigator.clipboard.writeText(newKey.key); toast('Nusxalandi', 'success'); }}
        >
          <Icon name="content_copy" size={16} /> Nusxalash
        </button>
      </Modal>
    </div>
  );
}
