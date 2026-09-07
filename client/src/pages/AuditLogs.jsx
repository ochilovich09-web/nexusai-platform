import { useEffect, useState, Fragment } from 'react';
import { api } from '../lib/api.js';
import { Card, StatCard, Icon, SeverityChip, Skeleton, useToast, fmt } from '../components/ui.jsx';

const LEVELS = [['all', 'Barchasi'], ['critical', 'Kritik'], ['high', 'Yuqori'], ['medium', "O'rta"], ['info', "Ma'lumot"]];

export default function AuditLogs() {
  const [logs, setLogs] = useState(null);
  const [integrity, setIntegrity] = useState(null);
  const [root, setRoot] = useState('');
  const [severity, setSeverity] = useState('all');
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState(null);
  const toast = useToast();

  const load = () => {
    const params = new URLSearchParams({ severity, ...(q ? { q } : {}) });
    return api.get(`/audit?${params}`).then((d) => {
      setLogs(d.logs); setIntegrity(d.integrity); setRoot(d.merkle_root);
    });
  };

  useEffect(() => { const t = setTimeout(() => load().catch(() => {}), 250); return () => clearTimeout(t); }, [severity, q]); // eslint-disable-line

  async function verify() {
    const r = await api.get('/audit/verify');
    setIntegrity(r);
    toast(r.valid ? `Zanjir yaxlit — ${r.total} ta yozuv tekshirildi` : `Zanjir buzilgan! ${r.brokenAt}-yozuvdan boshlab`, r.valid ? 'success' : 'error');
  }

  function exportCsv() {
    const head = 'seq,ts,actor,action,resource,ip,severity,status,hash\n';
    const body = (logs ?? []).map((l) =>
      [l.seq, l.ts, l.actor, l.action, l.resource, l.ip, l.severity, l.status, l.hash].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const url = URL.createObjectURL(new Blob([head + body], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `nexusai-audit-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[100rem] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-headline-xl">Audit jurnali</h1>
          <p className="meta mt-1 max-w-2xl">
            Har bir yozuv oldingi yozuv hash'iga bog'langan. Bitta qator o'zgartirilsa,
            keyingi barcha hash'lar buziladi va tekshiruv buni ko'rsatadi.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={exportCsv}><Icon name="download" size={18} /> CSV</button>
          <button className="btn-primary" onClick={verify}><Icon name="verified" size={18} /> Yaxlitlikni tekshirish</button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={integrity?.valid ? 'verified_user' : 'gpp_bad'}
          label="Zanjir yaxlitligi"
          value={integrity ? (integrity.valid ? 'Buzilmagan' : `Buzilgan #${integrity.brokenAt}`) : '…'}
          hint={`${integrity?.total ?? 0} ta yozuv`}
          tone={integrity?.valid ? 'tertiary' : 'error'}
        />
        <StatCard icon="tag" label="Merkle root" value={<span className="font-mono text-body-md break-all">{root.slice(0, 18)}…</span>} hint="Jurnalning yaxlit barmoq izi" />
        <StatCard icon="filter_alt" label="Ko'rsatilmoqda" value={fmt.num(logs?.length ?? 0)} hint="Joriy filtr bo'yicha" tone="secondary" />
      </div>

      <Card
        title={
          <div className="flex flex-wrap items-center gap-1">
            {LEVELS.map(([k, l]) => (
              <button key={k} onClick={() => setSeverity(k)}
                className={`h-8 px-3 rounded text-label-md ${severity === k ? 'bg-primary/15 text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
                {l}
              </button>
            ))}
          </div>
        }
        action={
          <div className="relative w-full sm:w-64">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input className="input pl-9 h-9 text-body-sm" placeholder="Amal, foydalanuvchi, resurs…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        }
        bodyClass="p-0"
      >
        {!logs ? (
          <div className="p-4 space-y-2">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-10 rounded" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm min-w-[52rem]">
              <thead className="text-label-sm text-on-surface-variant border-b border-outline-variant/60">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5 w-16">#</th>
                  <th className="text-left font-medium px-4 py-2.5">Vaqt</th>
                  <th className="text-left font-medium px-4 py-2.5">Foydalanuvchi</th>
                  <th className="text-left font-medium px-4 py-2.5">Amal</th>
                  <th className="text-left font-medium px-4 py-2.5">Daraja</th>
                  <th className="text-left font-medium px-4 py-2.5">Hash</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <Fragment key={l.id}>
                    <tr onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                      className="border-b border-outline-variant/40 last:border-0 hover:bg-surface-container-high/50 cursor-pointer">
                      <td className="px-4 py-2.5 font-mono text-on-surface-variant">{l.seq}</td>
                      <td className="px-4 py-2.5 font-mono text-on-surface-variant whitespace-nowrap">{fmt.time(l.ts)}</td>
                      <td className="px-4 py-2.5 truncate max-w-[12rem]">{l.actor}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-secondary">{l.action}</span>
                        {l.resource && <span className="meta text-label-sm block truncate max-w-[16rem]">{l.resource}</span>}
                      </td>
                      <td className="px-4 py-2.5"><SeverityChip level={l.severity} /></td>
                      <td className="px-4 py-2.5 font-mono text-label-sm text-on-surface-variant">{l.hash.slice(0, 12)}…</td>
                    </tr>
                    {expanded === l.id && (
                      <tr className="bg-surface-container-lowest">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="grid sm:grid-cols-2 gap-3 text-label-md font-mono">
                            <p><span className="text-on-surface-variant">IP: </span>{l.ip || '—'}</p>
                            <p><span className="text-on-surface-variant">Holat: </span>{l.status}</p>
                            <p className="sm:col-span-2 break-all"><span className="text-on-surface-variant">prev: </span>{l.prev_hash}</p>
                            <p className="sm:col-span-2 break-all"><span className="text-on-surface-variant">hash: </span>{l.hash}</p>
                            {Object.keys(l.meta ?? {}).length > 0 && (
                              <pre className="sm:col-span-2 !my-0 text-code-md bg-surface-container p-2.5 rounded overflow-x-auto">{JSON.stringify(l.meta, null, 2)}</pre>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
