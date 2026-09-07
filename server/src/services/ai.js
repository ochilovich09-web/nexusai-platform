/**
 * AI qatlami — bitta interfeys ostida uchta rejim:
 *   1. Anthropic Claude  (ANTHROPIC_API_KEY bo'lsa)
 *   2. Google Gemini     (GEMINI_API_KEY bo'lsa)
 *   3. OpenAI / OpenAI-mos endpoint (OPENAI_API_KEY bo'lsa — Ollama, vLLM, Groq, Together ham)
 *   4. demo — kalitsiz ham platforma to'liq ishlashi uchun lokal generator
 *
 * Barcha rejimlar token-token oqim (streaming) beradi.
 */

const REASONING_STEPS = [
  "1. USER QUESTION",
  "2. CONTEXT ANALYSIS",
  "3. PROBLEM DETECTION",
  "4. REASONING",
  "5. SOLUTION",
  "6. VERIFICATION",
];

export const ANSWER_DELIMITER = "---ANSWER---";

export function activeProvider() {
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic",
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
    };
  }
  if (process.env.GEMINI_API_KEY) {
    return {
      provider: "gemini",
      model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return { provider: "openai", model: process.env.OPENAI_MODEL || "gpt-4o" };
  }
  return { provider: "demo", model: "nexus-demo-core" };
}

export function buildSystemPrompt({
  reasoning = true,
  ragContext = "",
  persona = "",
} = {}) {
  let sys = `Sen — NexusAI Enterprise platformasining bosh yordamchisisan.
Ixtisosliging: dasturlash (Python, Go, Rust, JS/TS), tizim arxitekturasi, kiberxavfsizlik (OWASP, CVE, threat modeling), ma'lumotlar tahlili va hujjatlar auditi.

Qoidalar:
- Foydalanuvchi qaysi tilda yozsa, o'sha tilda javob ber. O'zbekcha so'ralsa — toza o'zbek tilida.
- Aniq va amaliy bo'l. Kod so'ralsa — ishlaydigan, to'liq kod ber va til nomi bilan markdown blokda yoz.
- Bilmagan narsangni to'qib chiqarma; noaniqlikni ochiq ayt.
- Xavfsizlik masalalarida zaiflikni nomla, ta'sirini va tuzatish yo'lini ko'rsat.`;

  if (persona) sys += `\n\nQo'shimcha ko'rsatma: ${persona}`;

  if (ragContext) {
    sys += `\n\n# Bilimlar bazasidan kontekst
Quyidagi parchalar foydalanuvchi hujjatlaridan olindi. Javobda ulardan foydalan va manbaga ishora qil.
<context>
${ragContext}
</context>`;
  }

  if (reasoning) {
    sys += `\n\n# Javob formati (majburiy)
Avval 6 bosqichli tahlilni AYNAN quyidagi teglar bilan yoz, har biri 1-3 gap:
${REASONING_STEPS.map((s) => `[${s}]: ...`).join("\n")}

Keyin alohida qatorda ${ANSWER_DELIMITER} yoz.
Undan keyin foydalanuvchiga to'liq yakuniy javobni ber. Yakuniy javobda teglarni takrorlama.`;
  }
  return sys;
}

/* ------------------------------------------------------------------ */
/* Anthropic                                                          */
/* ------------------------------------------------------------------ */
async function* streamAnthropic({
  system,
  messages,
  model,
  maxTokens,
  temperature,
}) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system,
      stream: true,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok)
    throw new Error(
      `Anthropic ${res.status}: ${(await res.text()).slice(0, 400)}`,
    );

  for await (const evt of sseLines(res.body)) {
    if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta")
      yield { text: evt.delta.text };
    if (evt.type === "message_delta" && evt.usage)
      yield { usage: { out: evt.usage.output_tokens } };
    if (evt.type === "message_start" && evt.message?.usage)
      yield { usage: { in: evt.message.usage.input_tokens } };
  }
}

/* ------------------------------------------------------------------ */
/* Google Gemini                                                       */
/* ------------------------------------------------------------------ */
async function* streamGemini({
  system,
  messages,
  model,
  maxTokens,
  temperature,
}) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}` +
    ":streamGenerateContent?alt=sse";

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: system }] },
    contents: messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      // Gemini 3 "thinking" tokenlari ham maxOutputTokens ichidan yeyiladi.
      // Platformaning o'z 6 bosqichli tahlili bor, shuning uchun ichki
      // fikrlashni past darajada ushlaymiz — aks holda javob yarimda uziladi.
      thinkingConfig: {
        thinkingLevel: process.env.GEMINI_THINKING_LEVEL || "low",
      },
    },
  });

  // 429/503 — Google tomonidagi vaqtinchalik yuklama. Oqim boshlanmagani uchun
  // bu yerda qayta urinish xavfsiz: foydalanuvchi hech narsani ko'rmagan.
  let res;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body,
    });
    if (res.ok || attempt >= 2 || (res.status !== 429 && res.status !== 503))
      break;
    await new Promise((r) => setTimeout(r, 700 * 2 ** attempt));
  }

  if (!res.ok)
    throw new Error(
      `Gemini ${res.status}: ${(await res.text()).slice(0, 400)}`,
    );

  for await (const evt of sseLines(res.body)) {
    const parts = evt.candidates?.[0]?.content?.parts;
    // p.thought === true — modelning ichki fikrlashi, foydalanuvchiga ko'rsatilmaydi.
    if (parts)
      for (const p of parts) if (p.text && !p.thought) yield { text: p.text };
    if (evt.usageMetadata) {
      yield {
        usage: {
          in: evt.usageMetadata.promptTokenCount,
          out: evt.usageMetadata.candidatesTokenCount,
        },
      };
    }
  }
}

/* ------------------------------------------------------------------ */
/* OpenAI-mos                                                          */
/* ------------------------------------------------------------------ */
async function* streamOpenAI({
  system,
  messages,
  model,
  maxTokens,
  temperature,
}) {
  const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      temperature,
      max_tokens: maxTokens,
      stream_options: { include_usage: true },
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  if (!res.ok)
    throw new Error(
      `OpenAI ${res.status}: ${(await res.text()).slice(0, 400)}`,
    );

  for await (const evt of sseLines(res.body)) {
    const delta = evt.choices?.[0]?.delta?.content;
    if (delta) yield { text: delta };
    if (evt.usage)
      yield {
        usage: {
          in: evt.usage.prompt_tokens,
          out: evt.usage.completion_tokens,
        },
      };
  }
}

/* ------------------------------------------------------------------ */
/* Demo rejim — API kalitisiz ishlaydi                                 */
/* ------------------------------------------------------------------ */
async function* streamDemo({ messages, reasoning }) {
  const last =
    [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const topic = last.replace(/\s+/g, " ").slice(0, 140);
  const parts = [];

  if (reasoning) {
    parts.push(
      `[1. USER QUESTION]: So'rov qabul qilindi — "${topic}".`,
      `[2. CONTEXT ANALYSIS]: Suhbat tarixi (${messages.length} xabar) va ulangan bilimlar bazasi tekshirildi.`,
      `[3. PROBLEM DETECTION]: Demo rejim faol: haqiqiy model kaliti (ANTHROPIC_API_KEY, GEMINI_API_KEY yoki OPENAI_API_KEY) topilmadi.`,
      `[4. REASONING]: Platformaning butun oqimi — oqimli javob, reasoning paneli, audit yozuvi va token hisobi — kalitsiz ham sinovdan o'tkazilishi kerak.`,
      `[5. SOLUTION]: server/.env faylida kalitni to'ldiring va serverni qayta ishga tushiring; interfeys o'zgarishsiz haqiqiy modelga ulanadi.`,
      `[6. VERIFICATION]: Ulanish holatini Sozlamalar sahifasidagi "AI provayder" bo'limidan tekshirish mumkin.`,
      ANSWER_DELIMITER,
    );
  }

  parts.push(
    `**Demo rejim ishlayapti.** So'rovingiz qabul qilindi: _${topic}_\n\n`,
    `Bu javobni haqiqiy model yozishi uchun \`server/.env\` faylida kalitni ko'rsating:\n\n`,
    "```bash\n",
    "ANTHROPIC_API_KEY=sk-ant-...\n",
    "ANTHROPIC_MODEL=claude-sonnet-4-6\n",
    "# yoki\n",
    "OPENAI_API_KEY=sk-...\n",
    "OPENAI_MODEL=gpt-4o\n",
    "```\n\n",
    `Kalit qo'yilgach, ushbu oyna, oqimli javob, 6 bosqichli tahlil paneli, RAG manbalari va audit jurnali aynan shu ko'rinishda haqiqiy model bilan ishlaydi.`,
  );

  const text = parts.join("\n");
  for (const tok of text.match(/\S+\s*|\s+/g) ?? []) {
    await new Promise((r) => setTimeout(r, 12));
    yield { text: tok };
  }
  yield {
    usage: {
      in: Math.round(last.length / 4),
      out: Math.round(text.length / 4),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Umumiy kirish nuqtasi                                               */
/* ------------------------------------------------------------------ */
export async function* streamChat({
  messages,
  reasoning = true,
  ragContext = "",
  persona = "",
  temperature = 0.6,
  maxTokens = 2048,
}) {
  const { provider, model } = activeProvider();
  const system = buildSystemPrompt({ reasoning, ragContext, persona });
  const args = { system, messages, model, maxTokens, temperature };

  try {
    if (provider === "anthropic") yield* streamAnthropic(args);
    else if (provider === "gemini") yield* streamGemini(args);
    else if (provider === "openai") yield* streamOpenAI(args);
    else yield* streamDemo({ messages, reasoning });
  } catch (err) {
    yield {
      text: `\n\n> **Model xatosi:** ${err.message}\n> Kalit va tarmoq ulanishini tekshiring.`,
    };
    yield { error: err.message };
  }
}

/** SSE oqimini JSON hodisalarga aylantiradi. */
async function* sseLines(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        yield JSON.parse(data);
      } catch {
        /* to'liq bo'lmagan bo'lak */
      }
    }
  }
}

/** Oqim tugagach reasoning va javobni ajratadi. */
export function splitReasoning(full) {
  const i = full.indexOf(ANSWER_DELIMITER);
  if (i === -1) return { reasoning: "", answer: full };
  return {
    reasoning: full.slice(0, i).trim(),
    answer: full.slice(i + ANSWER_DELIMITER.length).trim(),
  };
}
