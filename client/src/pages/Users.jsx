import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Card, StatCard, Icon, useToast, Skeleton, fmt } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const ROLES = [
  ['super_admin', 'Super administrator', 'chip-primary'],
  ['ai_engineer', 'AI muhandis', 'chip-ai'],
  ['security_analyst', 'Xavfsizlik tahlilchisi', 'chip-warn'],
  ['member', 'Xodim', 'chip-neutral'],
];

export default function Users() {
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState('');
  const { user: me, can } = useAuth();
  const toast = useToast();
  const isAdmin = can('super_admin');

  const load = () => api.get(`/users${q ? `?q=${encodeURIComponent(q)}` : ''}`).then((d) => setUsers(d.users));
  useEffect(() => { const t = setTimeout(() => load().catch(() => {}), 250); return () => clearTimeout(t); }, [q]); // eslint-disable-line

  async function update(id, patch) {
    try { await api.patch(`/users/${id}`, patch); await load(); toast('Foydalanuvchi yangilandi', 'success'); }
    catch (err) { toast(err.message, 'error'); }
  }

  const withTwoFa = users?.filter((u) => u.twofa_enabled).length ?? 0;

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[100rem] mx-auto">
      <header>
        <h1 className="text-headline-xl">Foydalanuvchilar va ruxsatlar</h1>
        <p className="meta mt-1 max-w-2xl">
          Rollar har bir sahifaga kirish va amallarni bajarish huquqini belgilaydi.
          Rolni faqat super administrator o'zgartira oladi.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon="group" label="Jami foydalanuvchilar" value={fmt.num(users?.length ?? 0)} />
        <StatCard icon="verified_user" label="2FA yoqilgan" value={`${withTwoFa} / ${users?.length ?? 0}`}
          hint={withTwoFa === users?.length ? 'Barcha hisoblar himoyalangan' : "Ba'zi hisoblarda 2FA yo'q"}
          tone={withTwoFa === users?.length ? 'tertiary' : 'warning'} />
        <StatCard icon="admin_panel_settings" label="Administratorlar"
          value={users?.filter((u) => u.role === 'super_admin').length ?? 0} tone="primary" />
      </div>

      <Card
        title="Ro'yxat"
        action={
          <div className="relative w-full sm:w-64">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input className="input pl-9 h-9 text-body-sm" placeholder="Ism yoki email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        }
        bodyClass="p-0"
      >
        {!users ? (
          <div className="p-4 space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-12 rounded" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm min-w-[48rem]">
              <thead className="text-label-sm text-on-surface-variant border-b border-outline-variant/60">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Foydalanuvchi</th>
                  <th className="text-left font-medium px-4 py-2.5">Bo'lim</th>
                  <th className="text-left font-medium px-4 py-2.5">Rol</th>
                  <th className="text-left font-medium px-4 py-2.5">2FA</th>
                  <th className="text-left font-medium px-4 py-2.5">So'nggi faollik</th>
                  <th className="text-right font-medium px-4 py-2.5">Holat</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-outline-variant/40 last:border-0 hover:bg-surface-container-high/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-label-sm font-semibold shrink-0">
                          {u.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{u.name}{u.id === me.id && <span className="meta"> · siz</span>}</p>
                          <p className="meta text-label-sm font-mono truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{u.department || '—'}</td>
                    <td className="px-4 py-3">
                      {isAdmin && u.id !== me.id ? (
                        <select className="select h-8 text-body-sm" value={u.role} onChange={(e) => update(u.id, { role: e.target.value })}>
                          {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      ) : (
                        <span className={ROLES.find((r) => r[0] === u.role)?.[2] ?? 'chip-neutral'}>
                          {ROLES.find((r) => r[0] === u.role)?.[1] ?? u.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.twofa_enabled
                        ? <span className="chip-ok"><Icon name="key_vertical" size={12} /> {u.twofa_method}</span>
                        : <span className="chip-warn"><Icon name="warning" size={12} /> yo'q</span>}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant font-mono text-label-md">{fmt.ago(u.last_active)}</td>
                    <td className="px-4 py-3 text-right">
                      {isAdmin && u.id !== me.id ? (
                        <button
                          className={u.status === 'active' ? 'btn-outline btn-sm' : 'btn-danger btn-sm'}
                          onClick={() => update(u.id, { status: u.status === 'active' ? 'suspended' : 'active' })}
                        >
                          {u.status === 'active' ? 'Faol' : "To'xtatilgan"}
                        </button>
                      ) : (
                        <span className={u.status === 'active' ? 'chip-ok' : 'chip-danger'}>{u.status === 'active' ? 'faol' : "to'xtatilgan"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
