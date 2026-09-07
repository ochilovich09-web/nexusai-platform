import { useState, memo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Icon, fmt } from './ui.jsx';

const STEP_RE = /\[(\d)\.\s*([^\]]+)\]:\s*/g;

/** Reasoning matnini bosqichlarga ajratadi. */
function parseSteps(trace) {
  if (!trace) return [];
  const steps = [];
  const matches = [...trace.matchAll(STEP_RE)];
  matches.forEach((m, i) => {
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : trace.length;
    steps.push({ n: m[1], title: m[2].trim(), body: trace.slice(start, end).trim() });
  });
  if (!steps.length) steps.push({ n: '·', title: 'Tahlil', body: trace.trim() });
  return steps;
}

function CodeBlock({ inline, className, children }) {
  const [copied, setCopied] = useState(false);
  const text = String(children).replace(/\n$/, '');
  const lang = /language-(\w+)/.exec(className || '')?.[1];

  if (inline || !text.includes('\n')) return <code className={className}>{children}</code>;

  return (
    <div className="relative group my-3">
      <div className="flex items-center justify-between px-3 h-8 bg-surface-container-high border border-b-0 border-outline-variant/60 rounded-t-md">
        <span className="text-label-sm font-mono text-on-surface-variant">{lang || 'kod'}</span>
        <button
          className="text-label-sm text-on-surface-variant hover:text-primary flex items-center gap-1"
          onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
        >
          <Icon name={copied ? 'check' : 'content_copy'} size={13} />
          {copied ? 'Nusxalandi' : 'Nusxalash'}
        </button>
      </div>
      <pre className="!mt-0 !rounded-t-none"><code className={className}>{text}</code></pre>
    </div>
  );
}

function ChatMessage({ message, streaming = false }) {
  const [open, setOpen] = useState(false);
  const isUser = message.role === 'user';
  const steps = parseSteps(message.reasoning);
  const sources = message.sources ?? [];

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 animate-fade-up">
        <div className="max-w-[min(46rem,88%)] rounded-md rounded-tr-sm bg-surface-container-high border border-outline-variant/60 px-4 py-3">
          <p className="text-body-lg whitespace-pre-wrap break-words">{message.content}</p>
          {!!message.attachments?.length && (
            <div className="flex flex-wrap gap-2 mt-3">
              {message.attachments.map((a, i) => (
                <span key={i} className="chip-neutral font-mono">
                  <Icon name="attach_file" size={12} /> {a.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="w-7 h-7 shrink-0 rounded-full bg-primary/20 text-primary flex items-center justify-center text-label-sm font-semibold mt-1">
          <Icon name="person" size={16} />
        </span>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-fade-up">
      <span className="w-7 h-7 shrink-0 rounded-md bg-secondary/15 border border-secondary/30 flex items-center justify-center mt-1">
        <Icon name="neurology" size={16} className="text-secondary" />
      </span>

      <div className="min-w-0 flex-1 max-w-[min(48rem,92%)]">
        {/* Fikrlash izi */}
        {(message.reasoning || (streaming && !message.content)) && (
          <div className="mb-3 rounded-md border border-secondary/25 bg-secondary/[0.06] overflow-hidden">
            <button
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
            >
              <Icon name="account_tree" size={16} className="text-secondary shrink-0" />
              <span className="text-body-md font-medium text-secondary">
                Fikrlash izi ({steps.length} bosqich)
              </span>
              {streaming && !message.content && (
                <span className="chip-ai ml-1">
                  <span className="w-1 h-1 rounded-full bg-secondary animate-pulse" /> tahlil qilinmoqda
                </span>
              )}
              <Icon name="expand_more" size={18}
                className={`ml-auto text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <ol className="px-3 pb-3 space-y-2.5 border-t border-secondary/20 pt-3">
                {steps.map((s, i) => (
                  <li key={i} className="text-body-sm">
                    <span className="font-mono text-label-sm text-primary mr-1.5">[{s.n}]</span>
                    <span className="font-medium text-on-surface">{s.title}:</span>{' '}
                    <span className="text-on-surface-variant">{s.body}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* Javob matni */}
        <div className="prose-nexus">
          {message.content ? (
            <Markdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>
              {message.content}
            </Markdown>
          ) : streaming ? (
            <span className="inline-flex gap-1 py-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-on-surface-variant animate-pulse"
                  style={{ animationDelay: `${i * 160}ms` }} />
              ))}
            </span>
          ) : null}
          {streaming && message.content && <span className="inline-block w-[2px] h-4 align-middle bg-primary animate-pulse ml-0.5" />}
        </div>

        {/* Manbalar */}
        {!!sources.length && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-label-sm text-on-surface-variant self-center">Manbalar:</span>
            {sources.map((s, i) => (
              <span key={i} className="chip-primary" title={`O'xshashlik ${s.score}`}>
                <Icon name="description" size={12} /> {s.title} · {s.chunk}-bo'lak
              </span>
            ))}
          </div>
        )}

        {/* Telemetriya */}
        {!streaming && message.model && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-label-sm text-on-surface-variant font-mono">
            <span>{message.model}</span>
            <span>{message.latency_ms} ms</span>
            <span>{fmt.num(message.tokens_in)} → {fmt.num(message.tokens_out)} token</span>
            <button
              className="hover:text-primary flex items-center gap-1"
              onClick={() => navigator.clipboard.writeText(message.content)}
            >
              <Icon name="content_copy" size={12} /> nusxalash
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ChatMessage);
