import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Card, StatCard, Icon, SeverityChip, Toggle, useToast, Skeleton, Progress, fmt } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function SecurityMonitor() {
  const [data, setData] = useState(null);
  const { can } = useAuth();
  const toast = useToast();
  const canAct = can('super_admin', 'security_analyst');

  const load = () => api.get('/security/overview').then(setData).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  async function setAlert(id, status) {
    try { await api.post(`/security/alerts/${id}`, { status }); await load(); toast('Signal holati yangilandi', 'success'); }
    catch (err) { toast(err.message, 'error'); }
  }

  if (!data) return <div className="p-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:8}).map((_,i)=><Skeleton key={i} className="h-28 rounded-md" />)}</div>;

  const { alerts, health, threat, policies } = data;
  const memPct = Math.round((health.mem_used_mb / health.mem_total_mb) * 100);
  const open = alerts.filter((a) => a.status === 'open');

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[100rem] mx-auto">
      <header>
        <h1 className="text-headline-xl">Xavfsizlik monitori</h1>
        <p className="meta mt-1 max-w-2xl">
          Tizim salomatligi, hujum telemetriyasi va himoya siyosatlari. Ko'rsatkichlar 15 soniyada yangilanadi.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="notifications_active" label="Ochiq signallar" value={open.length}
          hint={open.length ? "Ko'rib chiqish talab qilinadi" : 'Ochiq signal yo\u2018q'}
          tone={open.length ? 'error' : 'tertiary'} />
        <StatCard icon="lock_person" label="Muvaffaqiyatsiz kirishlar" value={threat.failed_logins_24h} hint="So'nggi 24 soatda" tone={threat.failed_logins_24h > 10 ? 'warning' : 'default'} />
        <StatCard icon="dns" label="Server ish vaqti" value={`${Math.floor(health.uptime_s / 3600)}s ${Math.floor((health.uptime_s % 3600) / 60)}d`} hint={`Node ${health.node}`} tone="secondary" />
        <StatCard icon="shield_lock" label="Transport himoyasi" value={health.tls} hint={`WAF: ${threat.waf}`} tone="tertiary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Real vaqt xavfsizlik signallari" bodyClass="p-0">
          {!alerts.length && <p className="meta p-6 text-center">Signallar yo'q.</p>}
          <ul>
            {alerts.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-4 py-3 border-b border-outline-variant/40 last:border-0">
                <Icon name={a.severity === 'high' ? 'gpp_maybe' : 'info'} size={18}
                  className={`mt-0.5 shrink-0 ${a.severity === 'high' ? 'text-error' : a.severity === 'medium' ? 'text-warning' : 'text-secondary'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-body-md font-medium">{a.title}</p>
                    <SeverityChip level={a.severity} />
                    {a.status !== 'open' && <span className="chip-neutral">{a.status === 'ack' ? 'ko\u2018rib chiqilmoqda' : 'hal qilindi'}</span>}
                  </div>
                  <p className="meta text-body-sm mt-0.5">{a.detail}</p>
                  <p className="meta text-label-sm font-mono mt-1">{a.source} · {fmt.ago(a.ts)}</p>
                </div>
                {canAct && a.status !== 'resolved' && (
                  <div className="flex gap-1 shrink-0">
                    {a.status === 'open' && (
                      <button className="btn-ghost btn-sm px-2" onClick={() => setAlert(a.id, 'ack')} title="Ko'rib chiqishga olish">
                        <Icon name="visibility" size={16} />
                      </button>
                    )}
                    <button className="btn-ghost btn-sm px-2 hover:text-tertiary" onClick={() => setAlert(a.id, 'resolved')} title="Hal qilindi">
                      <Icon name="task_alt" size={16} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card title="Infratuzilma holati">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-body-sm mb-1.5">
                  <span>Xotira</span>
                  <span className="font-mono text-on-surface-variant">{fmt.num(health.mem_used_mb)} / {fmt.num(health.mem_total_mb)} MB</span>
                </div>
                <Progress value={memPct} tone={memPct > 85 ? 'error' : 'primary'} />
              </div>
              <div>
                <div className="flex justify-between text-body-sm mb-1.5">
                  <span>CPU yuklamasi</span>
                  <span className="font-mono text-on-surface-variant">{health.cpu_load}</span>
                </div>
                <Progress value={Math.min(health.cpu_load * 25, 100)} tone="secondary" />
              </div>
              <div className="panel p-3 text-body-sm">
                <p className="flex justify-between"><span className="text-on-surface-variant">Rate limit</span><span className="font-mono">{threat.rate_limit}</span></p>
                <p className="flex justify-between mt-1.5"><span className="text-on-surface-variant">Bloklangan manbalar</span><span className="font-mono">{threat.blocked_ips}</span></p>
              </div>
            </div>
          </Card>

          <Card title="Himoya siyosatlari">
            <div className="divide-y divide-outline-variant/40">
              {policies.map((p) => (
                <Toggle key={p.name} checked={p.enabled} label={p.name} hint={p.detail} disabled onChange={() => {}} />
              ))}
            </div>
            <p className="meta text-label-sm mt-3">
              Siyosatlar server konfiguratsiyasidan o'qiladi va faqat administrator tomonidan o'zgartiriladi.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
