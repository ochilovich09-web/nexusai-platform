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

### B varianti — Vercel (frontend) + Railway (backend)

**Nega ikkiga bo'linadi?** Vercel'da fayl tizimi vaqtinchalik: SQLite bazasi
(`nexusai.db`) har so'rovdan keyin o'chib ketadi. Shuning uchun backend doimiy
diski (volume) bor hostda turadi, Vercel'da faqat frontend qoladi.

Tartib muhim: **avval backend**, chunki uning manzili frontend'ga kerak.

#### 1-qadam. Backend -> Railway

Loyihani GitHub'ga yuklang, so'ng Railway'da **New Project -> Deploy from GitHub repo**.
`railway.json` avtomatik o'qiladi (build va start buyruqlari o'sha yerda).

**a) Volume qo'shing** — bu eng muhim qadam, busiz baza yo'qoladi:

*Service -> Settings -> Volumes -> New Volume*, mount path: `/data`

**b) O'zgaruvchilarni kiriting** (*Variables* bo'limi):

| O'zgaruvchi | Qiymat |
|---|---|
| `DATA_DIR` | `/data` — volume manzili |
| `GEMINI_API_KEY` | AI Studio'dan olingan kalit |
| `JWT_SECRET` | uzun tasodifiy satr |
| `GEMINI_MODEL` | `gemini-3.6-flash` |
| `CLIENT_ORIGIN` | hozircha bo'sh (3-qadamda to'ldiriladi) |

`PORT` ni **qo'lda kiritmang** — Railway uni o'zi beradi, server esa uni o'qiydi.

**c) Domen oling**: *Settings -> Networking -> Generate Domain*.
Natijada `https://nexusai-api.up.railway.app` kabi manzil olasiz.

**d) Bazani to'ldiring** (bir marta, sinov hisoblari uchun):

```bash
railway run npm --prefix server run seed
```

#### 2-qadam. Frontend -> Vercel

```bash
npx vercel --prod
```

So'ng Vercel'da **Settings -> Environment Variables** ga qo'shing:

| O'zgaruvchi | Qiymat |
|---|---|
| `VITE_API_URL` | `https://nexusai-api.up.railway.app` |

Qo'shgandan keyin **qayta deploy qiling** — Vite bu qiymatni build paytida bundle ichiga yozadi.

#### 3-qadam. CORS'ni yopish

Railway'ga qaytib, `CLIENT_ORIGIN` ga Vercel domeningizni yozing
(vergul bilan bir nechta bo'lishi mumkin):

```bash
CLIENT_ORIGIN=https://your-app.vercel.app,https://your-app-git-main-you.vercel.app
```

Tayyor. Tekshirish: `https://nexusai-api.up.railway.app/api/health` javob berishi kerak.

#### Boshqa hostlar

`DATA_DIR` har qanday hostda ishlaydi — volume'ni ulab, shu o'zgaruvchiga uning
manzilini yozsangiz kifoya (Fly.io, Koyeb, Render, oddiy VPS). Shart faqat ikkitasi:
**doimiy disk** va **uzluksiz ishlaydigan protsess** (2FA kodlari, rate limiting va
oqimli javob shuni talab qiladi).

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
# yordamhub
