import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, streamMessage } from '../lib/api.js';
import { Icon, useToast, fmt } from '../components/ui.jsx';
import ChatMessage from '../components/ChatMessage.jsx';

const SUGGESTIONS = [
  ['terminal', 'Dasturlashda yordam', 'FastAPI, Redis kesh va API xavfsizligi'],
  ['description', 'Faylni tahlil qilish', 'Log, JSON va hujjatlarni tekshirish'],
  ['bug_report', 'Muammoni hal qilish', 'Arxitektura zaifliklarini topish'],
  ['route', 'Reja tuzish', 'Korxona miqyosidagi xavfsizlik rejasi'],
];

export default function Chat() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [streamingMsg, setStreamingMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState({ provider: 'demo', model: '—' });
  const [reasoning, setReasoning] = useState(true);
  const [useRag, setUseRag] = useState(true);
  const [listOpen, setListOpen] = useState(false);
  const [query, setQuery] = useState('');

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const abortRef = useRef(null);

  const loadConversations = useCallback(
    () => api.get('/chat/conversations').then((d) => setConversations(d.conversations)).catch(() => {}),
    [],
  );

  useEffect(() => { loadConversations(); api.get('/chat/provider').then(setProvider).catch(() => {}); }, [loadConversations]);

  useEffect(() => {
    if (!id) { setMessages([]); return; }
    api.get(`/chat/conversations/${id}`)
      .then((d) => setMessages(d.messages))
      .catch((e) => { toast(e.message, 'error'); nav('/chat'); });
  }, [id]); // eslint-disable-line

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: streamingMsg ? 'auto' : 'smooth' });
  }, [messages, streamingMsg]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [draft]);

  async function send(text) {
    const content = (text ?? draft).trim();
    if (!content || busy) return;

    let convId = id;
    if (!convId) {
      const { conversation } = await api.post('/chat/conversations', {});
      convId = conversation.id;
      nav(`/chat/${convId}`, { replace: true });
      setConversations((c) => [conversation, ...c]);
    }

    setDraft('');
    setBusy(true);
    setMessages((m) => [...m, { id: 'tmp_' + Date.now(), role: 'user', content, attachments: [] }]);
    setStreamingMsg({ id: 'stream', role: 'assistant', content: '', reasoning: '', sources: [] });

    const controller = new AbortController();
    abortRef.current = controller;
    let raw = '';
    const DELIM = '---ANSWER---';

    try {
      await streamMessage(convId, { content, reasoning, useRag }, {
        signal: controller.signal,
        meta: (d) => setStreamingMsg((s) => ({ ...s, sources: d.sources, model: d.model })),
        delta: (d) => {
          raw += d.text;
          const i = raw.indexOf(DELIM);
          setStreamingMsg((s) => ({
            ...s,
            reasoning: i === -1 ? (reasoning ? raw : '') : raw.slice(0, i),
            content: i === -1 ? (reasoning ? '' : raw) : raw.slice(i + DELIM.length),
          }));
        },
        done: (d) => {
          setMessages((m) => [...m, d.message]);
          setStreamingMsg(null);
          loadConversations();
        },
        error: (d) => toast(d.error, 'error'),
      });
    } catch (err) {
      if (err.name !== 'AbortError') toast(err.message, 'error');
      setStreamingMsg(null);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
    setBusy(false);
    if (streamingMsg?.content) setMessages((m) => [...m, { ...streamingMsg, id: 'stopped_' + Date.now() }]);
    setStreamingMsg(null);
  }

  async function removeConversation(cid, e) {
    e.stopPropagation();
    await api.del(`/chat/conversations/${cid}`);
    setConversations((c) => c.filter((x) => x.id !== cid));
    if (cid === id) nav('/chat');
    toast('Muloqot o\u2018chirildi', 'success');
  }

  const filtered = conversations.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()));
  const grouped = groupByDate(filtered);

  return (
    <div className="h-full flex min-h-0">
      {/* Muloqotlar ro'yxati */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-72 shrink-0 flex flex-col bg-surface-container-lowest
          border-r border-outline-variant/60 transition-transform duration-200
          ${listOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="p-3 space-y-2 border-b border-outline-variant/60">
          <button className="btn-primary w-full" onClick={() => { nav('/chat'); setListOpen(false); }}>
            <Icon name="add" size={18} /> Yangi muloqot
          </button>
          <div className="relative">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              className="input pl-9 h-9 text-body-sm"
              placeholder="Muloqotlarni qidirish…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {!filtered.length && <p className="meta text-center py-8">Muloqotlar yo'q</p>}
          {grouped.map(([label, items]) => (
            <div key={label} className="mb-3">
              <p className="text-label-sm text-on-surface-variant px-2 mb-1">{label}</p>
              {items.map((c) => (
                <div
                  key={c.id}
                  className={`group flex items-center gap-1 pl-2 pr-1 h-9 rounded transition-colors
                    ${c.id === id ? 'bg-primary/12 text-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                >
                  <button
                    onClick={() => { nav(`/chat/${c.id}`); setListOpen(false); }}
                    className="flex items-center gap-2 flex-1 min-w-0 text-body-sm text-left h-full"
                  >
                    <Icon name="chat_bubble" size={15} className="shrink-0" />
                    <span className="truncate">{c.title}</span>
                  </button>
                  <button
                    onClick={(e) => removeConversation(c.id, e)}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-error shrink-0 p-1 rounded"
                    aria-label="Muloqotni o'chirish"
                  >
                    <Icon name="delete" size={15} />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {listOpen && <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setListOpen(false)} />}

      {/* Suhbat maydoni */}
      <section className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 lg:px-6 py-6 space-y-6">
            {!messages.length && !streamingMsg && (
              <div className="card p-5 sm:p-6">
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="w-9 h-9 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center">
                    <Icon name="auto_awesome" size={20} className="text-primary" />
                  </div>
                  <h1 className="text-headline-lg">Bugun sizga qanday yordam bera olaman?</h1>
                </div>
                <p className="meta mb-5">
                  Kiberxavfsizlik tahlili, arxitektura rejalari yoki kod optimallashtirish bo'yicha so'rang.
                </p>
                <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {SUGGESTIONS.map(([icon, title, hint]) => (
                    <button
                      key={title}
                      onClick={() => send(`${title}: ${hint}`)}
                      className="card card-hover p-3.5 text-left"
                    >
                      <Icon name={icon} size={18} className="text-secondary" />
                      <p className="text-body-md font-medium mt-2">{title}</p>
                      <p className="meta text-body-sm mt-1">{hint}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => <ChatMessage key={m.id} message={m} />)}
            {streamingMsg && <ChatMessage message={streamingMsg} streaming />}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Kiritish paneli */}
        <div className="shrink-0 border-t border-outline-variant/60 bg-surface-container-low/90 backdrop-blur">
          <div className="max-w-4xl mx-auto px-4 lg:px-6 py-3">
            <div className="card p-2.5 focus-within:border-primary/50 transition-colors">
              <textarea
                ref={textareaRef}
                rows={1}
                className="w-full bg-transparent px-1.5 py-1 text-body-lg resize-none outline-none placeholder:text-on-surface-variant/60"
                placeholder="Muammoingizni yozing… (Shift+Enter — yangi qator)"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                }}
              />

              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <button className="btn-ghost btn-sm lg:hidden" onClick={() => setListOpen(true)}>
                  <Icon name="history" size={16} /> Tarix
                </button>

                <button
                  className={`btn-sm btn rounded-full border ${reasoning ? 'border-secondary/40 text-secondary bg-secondary/10' : 'border-outline-variant text-on-surface-variant'}`}
                  onClick={() => setReasoning((r) => !r)}
                  title="Modelning 6 bosqichli tahlilini ko'rsatish"
                >
                  <Icon name="account_tree" size={14} /> Fikrlash izi
                </button>

                <button
                  className={`btn-sm btn rounded-full border ${useRag ? 'border-primary/40 text-primary bg-primary/10' : 'border-outline-variant text-on-surface-variant'}`}
                  onClick={() => setUseRag((r) => !r)}
                  title="Bilimlar bazasidagi hujjatlardan foydalanish"
                >
                  <Icon name="library_books" size={14} /> Bilimlar bazasi
                </button>

                <span className="chip-neutral font-mono hidden sm:inline-flex">
                  <span className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: provider.provider === 'demo' ? 'rgb(var(--warning))' : 'rgb(var(--tertiary))' }} />
                  {provider.model}
                </span>

                <div className="ml-auto flex items-center gap-2">
                  <span className="meta text-label-sm hidden sm:inline font-mono">{fmt.num(draft.length)} belgi</span>
                  {busy ? (
                    <button className="btn-outline btn-sm" onClick={stop}>
                      <Icon name="stop_circle" size={16} /> To'xtatish
                    </button>
                  ) : (
                    <button className="btn-primary h-9 w-9 !px-0 rounded-full" onClick={() => send()} disabled={!draft.trim()} aria-label="Yuborish">
                      <Icon name="send" size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <p className="meta text-label-sm text-center mt-2">
              {provider.provider === 'demo'
                ? 'Demo rejim — haqiqiy model uchun server/.env faylida API kalitni ko\u2018rsating'
                : 'Suhbatlar shifrlangan holda saqlanadi va audit jurnaliga yoziladi'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function groupByDate(list) {
  const groups = { Bugun: [], Kecha: [], 'Oldingi 7 kun': [], Eskiroq: [] };
  const now = Date.now();
  list.forEach((c) => {
    const t = new Date((c.updated_at || '').replace(' ', 'T') + 'Z').getTime();
    const days = (now - t) / 86400000;
    if (days < 1) groups.Bugun.push(c);
    else if (days < 2) groups.Kecha.push(c);
    else if (days < 7) groups['Oldingi 7 kun'].push(c);
    else groups.Eskiroq.push(c);
  });
  return Object.entries(groups).filter(([, v]) => v.length);
}
