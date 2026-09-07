import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Line, ComposedChart,
} from 'recharts';
import { api } from '../lib/api.js';
import { Card, StatCard, Icon, Skeleton, Progress, fmt } from '../components/ui.jsx';

const RANGES = [
  ['24h', "So'nggi 24 soat"],
  ['7d', '7 kun'],
  ['30d', '30 kun'],
];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [range, setRange] = useState('7d');

  useEffect(() => {
    const load = () => api.get('/analytics').then(setData).catch(() => {});
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, []);

  if (!data) {
    return (
      <div className="p-4 lg:p-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-md" />)}
      </div>
    );
  }

  const { kpis, series, model_share, domains } = data;
  const chart = series.map((s) => ({ ...s, name: s.label }));

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[100rem] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-headline-xl">Korporativ boshqaruv va AI tahlili</h1>
          <p className="meta mt-1 max-w-2xl">
            Foydalanuvchi faolligi, model resurslari, token sarfi va jamoa ruxsatlarining yagona tahliliy markazi.
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded bg-surface-container border border-outline-variant/60">
          {RANGES.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              className={`h-8 px-3 rounded text-label-md transition-colors ${
                range === key ? 'bg-primary/15 text-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="group" label="Jami ro'yxatdan o'tganlar" value={fmt.num(kpis.users)} hint={`${kpis.active_now} ta ayni paytda faol`} />
        <StatCard icon="bolt" label="Jami AI so'rovlari" value={fmt.compact(kpis.requests)} hint={`O'rtacha ${kpis.avg_latency_ms} ms`} tone="secondary" />
        <StatCard icon="toll" label="Sarflangan tokenlar" value={fmt.compact(kpis.tokens)} hint="Kirish va chiqish jami" tone="primary" />
        <StatCard
          icon={kpis.error_rate > 1 ? 'error' : 'check_circle'}
          label="Xatolik darajasi"
          value={`${kpis.error_rate}%`}
          hint={kpis.error_rate > 1 ? 'SLA chegarasidan yuqori' : 'SLA 99.98% bajarilmoqda'}
          tone={kpis.error_rate > 1 ? 'error' : 'tertiary'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title={
            <div>
              <h2 className="text-headline-md">Faollik dinamikasi</h2>
              <p className="meta mt-0.5">Kunlik faol foydalanuvchilar va so'rovlar intensivligi</p>
            </div>
          }
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--outline-variant))" vertical={false} />
                <XAxis dataKey="name" stroke="rgb(var(--on-surface-variant))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="rgb(var(--on-surface-variant))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'rgb(var(--surface-container-high))',
                    border: '1px solid rgb(var(--outline-variant))',
                    borderRadius: 8, fontSize: 13, color: 'rgb(var(--on-surface))',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="requests" name="So'rovlar" fill="rgb(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={38} />
                <Bar dataKey="dau" name="Faol foydalanuvchi" fill="rgb(var(--secondary))" radius={[4, 4, 0, 0]} maxBarSize={38} />
                <Line type="monotone" dataKey="errors" name="Xatolar" stroke="rgb(var(--error))" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Model taqsimoti">
            {model_share.length ? (
              <ul className="space-y-3">
                {model_share.map((m) => {
                  const total = model_share.reduce((s, x) => s + x.n, 0) || 1;
                  const pct = Math.round((m.n / total) * 100);
                  return (
                    <li key={m.model}>
                      <div className="flex justify-between text-body-sm mb-1.5">
                        <span className="truncate pr-2">{m.model}</span>
                        <span className="text-primary font-mono">{pct}%</span>
                      </div>
                      <Progress value={pct} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="meta">Hozircha model chaqiruvlari yo'q.</p>
            )}
          </Card>

          <Card title="Eng faol sohalar">
            <div className="grid grid-cols-2 gap-2.5">
              {domains.map((d) => (
                <div key={d.name} className="panel p-3">
                  <p className="meta text-body-sm leading-snug">{d.name}</p>
                  <p className="text-headline-md mt-1">{d.share}%</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="forum" label="Muloqotlar" value={fmt.num(kpis.conversations)} hint="Barcha foydalanuvchilar bo'yicha" />
        <StatCard icon="library_books" label="Indekslangan hujjatlar" value={fmt.num(kpis.documents)} hint="Vektor bazasida" />
        <StatCard icon="speed" label="O'rtacha kechikish" value={`${kpis.avg_latency_ms} ms`} hint="Assistant javoblari" tone="tertiary" />
        <StatCard icon="wifi_tethering" label="Ayni paytda faol" value={fmt.num(kpis.active_now)} hint="So'nggi 15 daqiqada" tone="secondary" />
      </div>

      <p className="flex items-center gap-2 meta text-label-sm justify-center pt-2">
        <Icon name="lock" size={13} className="text-tertiary" />
        Barcha ko'rsatkichlar server bazasidan real vaqtda o'qiladi · 20 soniyada yangilanadi
      </p>
    </div>
  );
}
