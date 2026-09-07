# NexusAI Enterprise

Stitch dizayn eksportidan qurilgan to'liq ishlaydigan platforma: **React frontend + Node.js backend**.
Dizayn tokenlari (`DESIGN.md`) CSS o'zgaruvchilariga ko'chirilgan, shuning uchun qorong'i va yorug'
rejim bir tugma bilan almashadi.

## Nima ishlaydi

| Sahifa | Nima qiladi |
|---|---|
| **AI Assistant** (`/chat`) | Haqiqiy modelga ulanadi, javob token-token oqadi, 6 bosqichli fikrlash izi ochiladi, hujjatlardan manba ko'rsatiladi |
| **Boshqaruv paneli** (`/dashboard`) | KPI va grafiklar bazadagi haqiqiy ma'lumotdan hisoblanadi |
| **Model Studio** (`/models`) | Modellar ro'yxati, o'qitish telemetriyasi, benchmark, holatni boshqarish |
| **Bilimlar bazasi** (`/knowledge`) | Fayl yuklash, vektorlashtirish, semantik qidiruv testeri (RAG) |
| **Xavfsizlik monitori** (`/security`) | Signallar, server salomatligi, himoya siyosatlari |
| **Agent to'dasi** (`/agents`) | Agentlar holati va boshqaruv amallari |
| **Audit jurnali** (`/audit`) | Hash-zanjirli jurnal, yaxlitlik tekshiruvi, Merkle root, CSV eksport |
| **Foydalanuvchilar** (`/users`) | RBAC — rol va holatni boshqarish |
| **Sozlamalar** (`/settings`) | Profil, mavzu, doimiy AI ko'rsatmasi, 2FA, parol, API kalitlar |

Autentifikatsiya: JWT, bcrypt, ikki bosqichli tasdiqlash, parolni tiklash, rate limiting.

## Ishga tushirish

Talab: **Node.js 18+**

```bash
# 1. Paketlar
npm run install:all

# 2. Server sozlamasi
cp server/.env.example server/.env
#    server/.env ichida JWT_SECRET ni o'zgartiring va AI kalitini qo'ying

# 3. Boshlang'ich ma'lumotlar (sinov hisoblari, modellar, agentlar)
npm run seed

# 4. Ishga tushirish (backend + frontend birga)
npm run dev
```

Frontend: `http://localhost:5173` · Backend: `http://localhost:8787`

### Sinov hisoblari

| Email | Parol | Rol |
|---|---|---|
| admin@nexusai.uz | `Admin!2345678` | Super administrator (2FA yoqilgan) |
| madina@nexusai.uz | `Madina!2345678` | AI muhandis |
| bobur@nexusai.uz | `Bobur!2345678` | Xavfsizlik tahlilchisi |
| dilnoza@nexusai.uz | `Dilnoza!2345678` | Xodim |

2FA yoqilgan hisoblarda kod sinov qulayligi uchun ekranda ko'rsatiladi.
Ishlab chiqarishda `server/src/routes/auth.js` dagi `dev_code` maydonini olib tashlang va
kodni SMS/email orqali yuboring.

## AI modelni ulash

`server/.env` faylida bittasini to'ldiring:

```bash
# Google Gemini
GEMINI_API_KEY=AQ....
GEMINI_MODEL=gemini-3.6-flash
GEMINI_THINKING_LEVEL=low        # low | minimal | high

# yoki Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6

# yoki OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# yoki har qanday OpenAI-mos endpoint (Ollama, vLLM, Groq, Together)
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=llama3.1
```

Bir nechta kalit qo'yilsa, tartib: Anthropic -> Gemini -> OpenAI.
Kalitni AI Studio'dan olasiz: https://aistudio.google.com/apikey

Kalit bo'lmasa platforma **demo rejimda** ishlaydi — butun oqim (oqimli javob, fikrlash izi,
audit yozuvi, token hisobi) kalitsiz ham sinaladi.

## Ishlab chiqarishga chiqarish

### A varianti — bitta server (eng oddiy)

```bash
npm run build     # client/dist yasaladi
npm start         # server dist'ni ham tarqatadi, hammasi 8787-portda
```

`server/.env` da albatta o'zgartiring:
- `JWT_SECRET` — uzun tasodifiy satr
- `CLIENT_ORIGIN` — haqiqiy domen

### B varianti — hammasi Vercel'da (bepul)

Frontend ham, backend ham bitta Vercel loyihasida turadi.
Baza esa **Turso** (bulutdagi libSQL) — chunki Vercel'da disk vaqtinchalik.

#### 1-qadam. Turso bazasi

Windows'da eng oson yo'l — brauzer orqali (CLI o'rnatish shart emas):

1. https://turso.tech ga kiring va GitHub bilan ro'yxatdan o'ting (bepul reja yetarli).
2. **Create Database** -> nom: `nexusai`, hududni o'zingizga yaqinini tanlang.
3. Baza sahifasida ikkita qiymatni oling:
   - **Database URL** — `libsql://nexusai-...turso.io`
   - **Create Token** tugmasi orqali **auth token**

Bu ikkisini `server/.env` ga yozing:

```bash
TURSO_DATABASE_URL=libsql://nexusai-....turso.io
TURSO_AUTH_TOKEN=ey...
```

#### 2-qadam. Bazani to'ldirish

Lokal mashinada `server/.env` ga yuqoridagi ikki qiymatni yozing va bir marta ishga tushiring:

```bash
npm run seed
```

Bu sinov hisoblari va boshlang'ich ma'lumotlarni to'g'ridan-to'g'ri Turso'ga yozadi.

#### 3-qadam. Vercel'ga deploy

```bash
npx vercel --prod
```

**Settings -> Environment Variables** da quyidagilarni kiriting:

| O'zgaruvchi | Qiymat |
|---|---|
| `TURSO_DATABASE_URL` | `libsql://nexusai-...turso.io` |
| `TURSO_AUTH_TOKEN` | Turso tokeni |
| `GEMINI_API_KEY` | AI Studio kaliti |
| `JWT_SECRET` | uzun tasodifiy satr |

`VITE_API_URL` **kerak emas** — frontend va API bitta domenda, `/api` nisbiy yo'l ishlaydi.
`CLIENT_ORIGIN` ham kerak emas: bir xil domen bo'lgani uchun CORS muammosi yo'q.

Qo'shgandan keyin qayta deploy qiling.

#### Bu variantning cheklovlari

- **Rate limiting zaiflashadi** — hisoblagich har bir instansiya xotirasida, umumiy emas.
  Jiddiy himoya kerak bo'lsa uni ham Turso'ga yoki Upstash Redis'ga ko'chirish lozim.
- **Funksiya muddati 60 soniya** (`vercel.json` dagi `maxDuration`). Juda uzun
  javoblarda oqim uzilishi mumkin.

### C varianti — doimiy diskli host

Turso'siz, oddiy SQLite fayli bilan: Railway, Fly.io, Koyeb yoki oddiy VPS.
`DATA_DIR` o'zgaruvchisiga volume manzilini bering (masalan `/data`), `TURSO_DATABASE_URL`
ni esa bo'sh qoldiring — kod avtomatik lokal fayl rejimiga o'tadi.
Frontend'ni Vercel'da qoldirsangiz, `VITE_API_URL` va `CLIENT_ORIGIN` ni to'ldiring.

#### Diqqat — kalit haqida

`GEMINI_API_KEY` faqat **backend**da turadi. Uni hech qachon `VITE_` prefiksi bilan
yozmang: Vite bunday o'zgaruvchilarni brauzer bundle'iga ochiq matn sifatida joylaydi
va kalitni istalgan odam ko'ra oladi.

## Loyiha tuzilishi

```
server/src/
  db.js                 SQLite sxema
  index.js              Express kirish nuqtasi
  seed.js               boshlang'ich ma'lumotlar
  middleware/auth.js    JWT va rol tekshiruvi
  services/ai.js        Anthropic / Gemini / OpenAI / demo — oqimli
  services/rag.js       bo'laklash, vektorlash, kosinus qidiruv
  services/audit.js     hash-zanjir va Merkle root
  routes/               auth, chat, knowledge, platform

client/src/
  index.css             dizayn tokenlari (dark + light)
  tailwind.config.js    tokenlarni Tailwind'ga bog'laydi
  context/              mavzu va autentifikatsiya
  components/           Shell, ChatMessage, UI primitivlari
  pages/                9 ta sahifa
```

## Ma'lumotlar bazasi

SQLite fayli `server/data/nexusai.db` da yaratiladi.
`DATA_DIR` o'zgaruvchisi bilan boshqa papkaga (masalan host volume'iga) ko'chiriladi.
Tozalab qayta boshlash:

```bash
rm -rf server/data && npm run seed
```

PostgreSQL'ga o'tish uchun faqat `server/src/db.js` ni almashtirish kifoya —
qolgan kod so'rovlarni shu modul orqali bajaradi.

## Xavfsizlik haqida eslatma

Kod ishlab chiqarish uchun asos sifatida yozilgan, lekin jonli tizimga chiqarishdan oldin:
HTTPS majburiy qiling, `JWT_SECRET` ni almashtiring, 2FA kodini haqiqiy kanal orqali yuboring,
fayl yuklashda antivirus tekshiruvini qo'shing va audit bazasidan muntazam zaxira oling.
