import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { api } from '../lib/api.js';
import { Card, StatCard, Icon, Modal, Progress, useToast, Skeleton } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const STATUS = {
  serving: ['chip-ok', 'Ishlamoqda'],
  training: ['chip-warn', "O'qitilmoqda"],
  idle: ['chip-neutral', 'Kutmoqda'],
  failed: ['chip-danger', 'Xato'],
};

export default function ModelStudio() {
  const [models, setModels] = useState(null);
  const [provider, setProvider] = useState(null);
  const [selected, setSelected] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', arch: '', version: 'v1.0', deployment: 'on_prem' });
  const [filter, setFilter] = useState('all');

  const { can } = useAuth();
  const toast = useToast();
  const editable = can('super_admin', 'ai_engineer');

  const load = () => api.get('/models').then((d) => { setModels(d.models); setProvider(d.provider); });

  useEffect(() => { load().catch(() => {}); }, []);

  useEffect(() => {
    if (!selected) { setTelemetry(null); return; }
    api.get(`/models/${selected}/telemetry`).then(setTelemetry).catch(() => {});
  }, [selected]);

  async function createModel(e) {
    e.preventDefault();
    try {
      await api.post('/models', form);
      setCreating(false);
      setForm({ name: '', arch: '', version: 'v1.0', deployment: 'on_prem' });
      await load();
      toast("Model yaratildi va o'qitish navbatiga qo'yildi", 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function setStatus(id, status) {
    try {
      await api.patch(`/models/${id}`, { status });
      await load();
      toast('Model holati yangilandi', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  if (!models) return <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-md" />)}</div>;

  const list = filter === 'all' ? models : models.filter((m) => m.deployment === filter);
  const serving = models.filter((m) => m.status === 'serving').length;
  const avgLatency = Math.round(models.filter((m) => m.latency_ms).reduce((s, m) => s + m.latency_ms, 0) / (models.filter((m) => m.latency_ms).length || 1));

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[100rem] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-headline-xl">Model studiyasi</h1>
          <p className="meta mt-1 max-w-2xl">
            Modellarni fine-tuning qilish, LoRA adapterlarini boshqarish, benchmark baholash va inference xizmatlarini orkestratsiya qilish markazi.
          </p>
        </div>
        {editable && (
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <Icon name="add" size={18} /> Yangi model o'qitish
          </button>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="ac_unit" label="Faol modellar" value={`${serving} / ${models.length}`} hint="Xizmat ko'rsatmoqda" tone="tertiary" />
        <StatCard icon="memory" label="Klaster GPU quvvati" value="8× A100" hint="80GB SXM4 · yuklama 72%" />
        <StatCard icon="speed" label="O'rtacha kechikish" value={`${avgLatency} ms`} hint="TTFT bo'yicha" tone="secondary" />
        <StatCard
          icon="verified_user"
          label="Aktiv AI provayder"
          value={provider?.provider === 'demo' ? 'Demo' : provider?.provider}
          hint={provider?.model}
          tone={provider?.provider === 'demo' ? 'warning' : 'primary'}
        />
      </div>

      <Card
        title={
          <div className="flex items-center gap-2">
            {[['all', 'Barcha modellar'], ['on_prem', 'On-premise'], ['cloud', 'Cloud API']].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`h-8 px-3 rounded text-label-md ${filter === k ? 'bg-primary/15 text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                {l}
              </button>
            ))}
          </div>
        }
        bodyClass="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-body-sm min-w-[46rem]">
            <thead className="text-label-sm text-on-surface-variant border-b border-outline-variant/60">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Model va arxitektura</th>
                <th className="text-left font-medium px-4 py-2.5">Versiya</th>
                <th className="text-left font-medium px-4 py-2.5">Holat</th>
                <th className="text-left font-medium px-4 py-2.5">Asosiy qobiliyat</th>
                <th className="text-left font-medium px-4 py-2.5">Kechikish</th>
                <th className="text-right font-medium px-4 py-2.5">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => {
                const [cls, label] = STATUS[m.status] ?? STATUS.idle;
                return (
                  <tr key={m.id} className="border-b border-outline-variant/40 last:border-0 hover:bg-surface-container-high/50">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <Icon name="network_intelligence" size={18} className="text-primary mt-0.5" />
                        <div className="min-w-0">
                          <p className="font-medium text-on-surface">{m.name}</p>
                          <p className="meta text-label-sm truncate max-w-xs">{m.arch}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-label-md text-on-surface-variant">{m.version}</td>
                    <td className="px-4 py-3">
                      <span className={cls}>{label}</span>
                      {m.status === 'training' && <Progress value={m.progress} tone="warning" className="mt-1.5 w-24" />}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {m.capabilities.slice(0, 2).map((c) => <span key={c} className="chip-neutral">{c}</span>)}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-on-surface-variant">{m.latency_ms ? `${m.latency_ms} ms` : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost btn-sm px-2" onClick={() => setSelected(m.id)} title="Telemetriya">
                          <Icon name="monitoring" size={16} />
                        </button>
                        {editable && (
                          <button
                            className="btn-ghost btn-sm px-2"
                            onClick={() => setStatus(m.id, m.status === 'serving' ? 'idle' : 'serving')}
                            title={m.status === 'serving' ? "To'xtatish" : 'Ishga tushirish'}
                          >
                            <Icon name={m.status === 'serving' ? 'pause_circle' : 'play_circle'} size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Telemetriya paneli */}
      {telemetry && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card
            title={
              <div>
                <h2 className="text-headline-md">Jonli o'qitish telemetriyasi</h2>
                <p className="meta mt-0.5">{telemetry.model.name} · epoch {telemetry.model.metrics.epoch}/{telemetry.model.metrics.epochs}</p>
              </div>
            }
            action={<button className="btn-ghost btn-sm px-2" onClick={() => setSelected(null)}><Icon name="close" size={16} /></button>}
          >
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={telemetry.curve} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--outline-variant))" vertical={false} />
                  <XAxis dataKey="step" stroke="rgb(var(--on-surface-variant))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgb(var(--on-surface-variant))" fontSize={11} tickLine={false} axisLine={false} domain={[0, 2]} />
                  <Tooltip contentStyle={{ background: 'rgb(var(--surface-container-high))', border: '1px solid rgb(var(--outline-variant))', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="train" name="Train loss" stroke="rgb(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="val" name="Val loss" stroke="rgb(var(--secondary))" strokeWidth={2} strokeDasharray="4 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Benchmark va red-teaming">
            <ul className="space-y-3.5">
              {telemetry.benchmarks.map((b) => (
                <li key={b.name}>
                  <div className="flex justify-between text-body-sm mb-1.5">
                    <span>{b.name}</span>
                    <span className="font-mono text-tertiary">{b.score}%</span>
                  </div>
                  <Progress value={b.score} tone={b.score > 90 ? 'tertiary' : 'primary'} />
                </li>
              ))}
            </ul>
            <div className="mt-4 panel p-3 flex gap-2.5 border-tertiary/30 bg-tertiary/[0.06]">
              <Icon name="verified_user" size={18} className="text-tertiary shrink-0 mt-0.5" />
              <div>
                <p className="text-body-md text-tertiary font-medium">Red-teaming himoyasi: {telemetry.redteam.pass_rate}%</p>
                <p className="meta text-body-sm mt-0.5">
                  {telemetry.redteam.scenarios} ta jailbreak va prompt injection stsenariysi bloklandi.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Yangi model o'qitish"
        footer={
          <>
            <button className="btn-outline" onClick={() => setCreating(false)}>Bekor qilish</button>
            <button className="btn-primary" onClick={createModel}>O'qitishni boshlash</button>
          </>
        }
      >
        <form className="space-y-3.5" onSubmit={createModel}>
          <label className="block">
            <span className="block text-label-md text-on-surface-variant mb-1.5">Model nomi</span>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Masalan: Mistral-Large-Uzbek" />
          </label>
          <label className="block">
            <span className="block text-label-md text-on-surface-variant mb-1.5">Arxitektura</span>
            <input className="input" value={form.arch} onChange={(e) => setForm({ ...form, arch: e.target.value })} placeholder="Mistral Large 2 LoRA" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-label-md text-on-surface-variant mb-1.5">Versiya</span>
              <input className="input" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
            </label>
            <label className="block">
              <span className="block text-label-md text-on-surface-variant mb-1.5">Joylashuv</span>
              <select className="select" value={form.deployment} onChange={(e) => setForm({ ...form, deployment: e.target.value })}>
                <option value="on_prem">On-premise</option>
                <option value="cloud">Cloud API</option>
              </select>
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
