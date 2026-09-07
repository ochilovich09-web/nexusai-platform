import { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api.js';
import { Card, StatCard, Icon, EmptyState, useToast, Modal, fmt, Skeleton } from '../components/ui.jsx';

export default function KnowledgeBase() {
  const [docs, setDocs] = useState(null);
  const [stats, setStats] = useState({});
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState(null);
  const [searching, setSearching] = useState(false);
  const [latency, setLatency] = useState(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState({ title: '', text: '' });
  const [uploading, setUploading] = useState(false);

  const fileRef = useRef(null);
  const toast = useToast();

  const load = () => api.get('/kb/documents').then((d) => { setDocs(d.documents); setStats(d.stats); });
  useEffect(() => { load().catch(() => {}); }, []);

  async function upload(file) {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.upload('/kb/documents', fd);
      await load();
      toast(`${file.name} indekslandi`, 'success');
    } catch (err) { toast(err.message, 'error'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function savePaste() {
    try {
      const fd = new FormData();
      fd.append('title', paste.title || 'Nomsiz hujjat');
      fd.append('text', paste.text);
      await api.upload('/kb/documents', fd);
      setPasteOpen(false);
      setPaste({ title: '', text: '' });
      await load();
      toast('Hujjat indekslandi', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function remove(id) {
    await api.del(`/kb/documents/${id}`);
    await load();
    toast("Hujjat o'chirildi", 'success');
  }

  async function runSearch(e) {
    e?.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await api.post('/kb/search', { query, topK: 5 });
      setHits(r.hits);
      setLatency(r.latency_ms);
    } catch (err) { toast(err.message, 'error'); }
    finally { setSearching(false); }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[100rem] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-headline-xl">Bilimlar bazasi va vektor qidiruv</h1>
          <p className="meta mt-1 max-w-2xl">
            Hujjatlar bo'laklarga ajratilib vektorlashtiriladi. Chatda "Bilimlar bazasi" yoqilganda
            javoblar shu hujjatlarga tayanadi va manba ko'rsatiladi.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={() => setPasteOpen(true)}>
            <Icon name="edit_note" size={18} /> Matn qo'shish
          </button>
          <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Icon name="upload_file" size={18} /> {uploading ? 'Yuklanmoqda…' : 'Fayl yuklash'}
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".txt,.md,.json,.csv,.log,.yaml,.yml,.js,.ts,.py,.go,.rs,.java,.sql,.html,.css"
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon="description" label="Hujjatlar" value={fmt.num(stats.documents)} hint="Sizning bazangizda" />
        <StatCard icon="dataset" label="Vektor bo'laklari" value={fmt.num(stats.chunks)} hint="384 o'lchamli vektorlar" tone="secondary" />
        <StatCard icon="database" label="Indeks hajmi" value={fmt.bytes(stats.bytes)} hint="Xom matn hajmi" tone="primary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Indekslangan hujjatlar" bodyClass="p-0">
          {!docs ? (
            <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded" />)}</div>
          ) : !docs.length ? (
            <EmptyState
              icon="library_books"
              title="Baza hozircha bo'sh"
              hint="Matnli fayl yuklang yoki matn qo'shing — hujjat darhol bo'laklarga ajratilib indekslanadi."
              action={<button className="btn-primary" onClick={() => fileRef.current?.click()}><Icon name="upload_file" size={18} /> Fayl yuklash</button>}
            />
          ) : (
            <ul>
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/40 last:border-0 hover:bg-surface-container-high/50">
                  <div className="w-9 h-9 rounded bg-primary/12 border border-primary/25 flex items-center justify-center shrink-0">
                    <Icon name="description" size={18} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-md font-medium truncate">{d.title}</p>
                    <p className="meta text-label-sm font-mono truncate">
                      {d.chunk_count} bo'lak · {fmt.bytes(d.size)} · {fmt.ago(d.created_at)}
                    </p>
                  </div>
                  <span className="chip-ok hidden sm:inline-flex"><Icon name="check" size={12} /> indekslangan</span>
                  <button className="btn-ghost btn-sm px-2 hover:text-error" onClick={() => remove(d.id)} aria-label="O'chirish">
                    <Icon name="delete" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Semantik qidiruv sinovi">
          <form onSubmit={runSearch} className="space-y-2.5">
            <textarea
              className="textarea"
              rows={3}
              placeholder="Masalan: parol talablari qanday?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="btn-primary w-full" disabled={searching || !query.trim()}>
              <Icon name="search" size={18} /> {searching ? 'Qidirilmoqda…' : 'Qidirish'}
            </button>
          </form>

          {hits && (
            <div className="mt-4">
              <p className="meta text-label-sm mb-2 font-mono">
                {hits.length} natija · {latency} ms
              </p>
              {!hits.length && <p className="meta">Mos bo'lak topilmadi. Avval hujjat yuklang.</p>}
              <ul className="space-y-2.5">
                {hits.map((h) => (
                  <li key={h.id} className="panel p-3">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-body-sm font-medium truncate">{h.title}</span>
                      <span className="chip-primary font-mono shrink-0">{h.score.toFixed(3)}</span>
                    </div>
                    <p className="meta text-body-sm line-clamp-3">{h.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        title="Matnli hujjat qo'shish"
        width="max-w-2xl"
        footer={
          <>
            <button className="btn-outline" onClick={() => setPasteOpen(false)}>Bekor qilish</button>
            <button className="btn-primary" onClick={savePaste} disabled={!paste.text.trim()}>Indekslash</button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="block text-label-md text-on-surface-variant mb-1.5">Sarlavha</span>
            <input className="input" value={paste.title} onChange={(e) => setPaste({ ...paste, title: e.target.value })} placeholder="Ichki qoidalar" />
          </label>
          <label className="block">
            <span className="block text-label-md text-on-surface-variant mb-1.5">Matn</span>
            <textarea className="textarea" rows={10} value={paste.text} onChange={(e) => setPaste({ ...paste, text: e.target.value })} />
          </label>
        </div>
      </Modal>
    </div>
  );
}
