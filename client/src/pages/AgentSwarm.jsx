import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Card, StatCard, Icon, Progress, useToast, Skeleton, fmt } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const STATUS = {
  active: ['chip-ok', 'Faol', 'tertiary'],
  idle: ['chip-neutral', 'Kutmoqda', 'outline'],
  patching: ['chip-warn', 'Tuzatmoqda', 'warning'],
  quarantined: ['chip-danger', 'Karantinda', 'error'],
};

const ACTIONS = [
  ['activate', 'play_arrow', 'Ishga tushirish'],
  ['pause', 'pause', 'To\u2018xtatish'],
  ['patch', 'build', 'Tuzatma qo\u2018llash'],
  ['quarantine', 'block', 'Karantin'],
];

export default function AgentSwarm() {
  const [agents, setAgents] = useState(null);
  const { can } = useAuth();
  const toast = useToast();
  const canAct = can('super_admin', 'security_analyst');

  const load = () => api.get('/agents').then((d) => setAgents(d.agents));
  useEffect(() => { load().catch(() => {}); const t = setInterval(() => load().catch(() => {}), 20000); return () => clearInterval(t); }, []);

  async function act(id, action) {
    try { await api.post(`/agents/${id}/action`, { action }); await load(); toast('Agent holati yangilandi', 'success'); }
    catch (err) { toast(err.message, 'error'); }
  }

  if (!agents) return <div className="p-6 grid gap-3 md:grid-cols-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-40 rounded-md" />)}</div>;

  const active = agents.filter((a) => a.status === 'active').length;
  const avgConf = agents.reduce((s, a) => s + a.confidence, 0) / (agents.length || 1);

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[100rem] mx-auto">
      <header>
        <h1 className="text-headline-xl">Avtonom agent to'dasi</h1>
        <p className="meta mt-1 max-w-2xl">
          Har bir agent alohida vazifani bajaradi: hujumni modellashtirish, kodni audit qilish,
          so'rovlarni qayta tekshirish va zaifliklarga tuzatma tayyorlash.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon="hub" label="Faol agentlar" value={`${active} / ${agents.length}`} hint="Konsensus matritsasida" tone="tertiary" />
        <StatCard icon="target" label="O'rtacha ishonch" value={`${(avgConf * 100).toFixed(1)}%`} hint="Agentlar qarorlari bo'yicha" tone="secondary" />
        <StatCard icon="healing" label="Self-healing" value={agents.filter((a) => a.status === 'patching').length} hint="Tuzatma tayyorlanmoqda" tone="warning" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {agents.map((a) => {
          const [cls, label, tone] = STATUS[a.status] ?? STATUS.idle;
          return (
            <Card key={a.id} className="card-hover">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-primary/12 border border-primary/25 flex items-center justify-center shrink-0">
                  <Icon name="smart_toy" size={20} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-headline-md">{a.name}</h2>
                    <span className={cls}>{label}</span>
                  </div>
                  <p className="meta mt-1">{a.role}</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex justify-between text-body-sm mb-1.5">
                  <span className="text-on-surface-variant">Qaror ishonchi</span>
                  <span className="font-mono">{(a.confidence * 100).toFixed(0)}%</span>
                </div>
                <Progress value={a.confidence * 100} tone={tone === 'outline' ? 'primary' : tone} />
              </div>

              <div className="mt-3 panel p-3">
                <p className="text-label-sm text-on-surface-variant mb-1">So'nggi amal</p>
                <p className="text-body-sm">{a.last_action || '—'}</p>
                <p className="meta text-label-sm font-mono mt-1.5">{fmt.ago(a.updated_at)}</p>
              </div>

              {canAct && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {ACTIONS.map(([action, icon, label]) => (
                    <button key={action} className="btn-outline btn-sm" onClick={() => act(a.id, action)}>
                      <Icon name={icon} size={14} /> {label}
                    </button>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
