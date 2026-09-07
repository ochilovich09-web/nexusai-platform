import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db, uid } from './db.js';
import { writeAudit } from './services/audit.js';
import { indexDocument } from './services/rag.js';

console.log('Boshlang\u2018ich ma\u2019lumotlar yozilmoqda…');

db.exec('DELETE FROM chunks; DELETE FROM documents; DELETE FROM messages; DELETE FROM conversations; DELETE FROM api_keys; DELETE FROM users; DELETE FROM models; DELETE FROM agents; DELETE FROM alerts; DELETE FROM audit_logs; DELETE FROM metrics;');

const pw = (p) => bcrypt.hashSync(p, 10);

const users = [
  { id: uid('usr'), email: 'admin@nexusai.uz',   name: 'Alisher Qosimov',   role: 'super_admin',      department: 'Kiberxavfsizlik & IT', twofa: ['fido2', 1], pass: 'Admin!2345678' },
  { id: uid('usr'), email: 'madina@nexusai.uz',  name: 'Madina Karimova',   role: 'ai_engineer',      department: 'R&D & AI Model Lab',   twofa: ['yubikey', 1], pass: 'Madina!2345678' },
  { id: uid('usr'), email: 'bobur@nexusai.uz',   name: 'Bobur Saidov',      role: 'security_analyst', department: 'SOC & Incident Response', twofa: ['totp', 1], pass: 'Bobur!2345678' },
  { id: uid('usr'), email: 'dilnoza@nexusai.uz', name: 'Dilnoza Rasulova',  role: 'member',           department: 'Buxgalteriya & Moliya', twofa: ['none', 0], pass: 'Dilnoza!2345678' },
];

const insUser = db.prepare(`INSERT INTO users (id, email, name, password_hash, role, department, twofa_method, twofa_enabled)
                            VALUES (?,?,?,?,?,?,?,?)`);
users.forEach((u) => insUser.run(u.id, u.email, u.name, pw(u.pass), u.role, u.department, u.twofa[0], u.twofa[1]));

const models = [
  ['Nexus-v4 Core', 'Ko\u2018p maqsadli asosiy model \u2022 1M kontekst', 'v4.2.1', 'serving', 'Fine-Tuned', ['Kodlash', 'Kiberxavfsizlik', 'Tahlil'], 42, 'cloud', 100],
  ['Llama-3-70B-CyberSec', 'Meta Llama 3 70B \u2022 vLLM Node-01', 'v2.4', 'serving', 'On-Prem LoRA', ['Zero-Data-Leak', 'SOC Logs'], 88, 'on_prem', 100],
  ['DeepReason-Enterprise-Code', 'DeepSeek-Coder 33B \u2022 vLLM', 'v1.8', 'serving', 'Full Weights', ['Python/Rust/Go', 'Exploit tahlili'], 63, 'on_prem', 100],
  ['Claude-3.5-Sonnet-GovAudit', 'Anthropic API \u2022 TLS 1.3', 'v3.1', 'serving', 'Cloud API', ['Shartnomalar', 'Normativ aktlar'], 120, 'cloud', 100],
  ['Mistral-Large-Uzbek', 'Mistral Large 2 LoRA \u2022 Epoch 3/5', 'v1.0-exp', 'training', 'Training', ['O\u2018zbek tili', 'Lex korpus'], 0, 'on_prem', 68],
];
const insModel = db.prepare(`INSERT INTO models (id, name, arch, version, status, badge, capabilities, latency_ms, deployment, progress, metrics)
                             VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
models.forEach((m) => insModel.run(uid('mdl'), m[0], m[1], m[2], m[3], m[4], JSON.stringify(m[5]), m[6], m[7], m[8],
  JSON.stringify({ train_loss: 0.32, val_loss: 0.38, epoch: m[3] === 'training' ? 3 : 5, epochs: 5 })));

const agents = [
  ['Red-Team Adversary', 'Hujum stsenariylarini avtomatik sinaydi', 'active', 0.94, 'Prompt injection to\u2018plami ishga tushirildi'],
  ['Code Guard Auditor', 'Kodni CVE va sirlar bo\u2018yicha tekshiradi', 'active', 0.97, '3 ta qattiq kodlangan kalit topildi'],
  ['Zero-Trust Sentinel', 'Har bir so\u2018rovni qayta autentifikatsiya qiladi', 'active', 0.99, 'Anomal IP bloklandi'],
  ['Self-Healing Patch Agent', 'Zaifliklarga tuzatma tayyorlaydi', 'patching', 0.88, 'Rate-limiter uchun patch tayyor'],
  ['Mind-Mirror Drift Monitor', 'Gallyutsinatsiya va siljishni kuzatadi', 'idle', 0.91, 'Kechagi bazaviy o\u2018lchov saqlandi'],
];
const insAgent = db.prepare('INSERT INTO agents (id, name, role, status, confidence, last_action) VALUES (?,?,?,?,?,?)');
agents.forEach((a) => insAgent.run(uid('agt'), a[0], a[1], a[2], a[3], a[4]));

const alerts = [
  ['Bir IP\u2019dan ketma-ket muvaffaqiyatsiz kirish', '185.220.x.x manzilidan 47 urinish, 6 daqiqada', 'high', 'auth-gateway'],
  ['Token sarfi limitga yaqin', 'Marketing bo\u2018limi oylik kvotaning 91% ini sarfladi', 'medium', 'rate-limiter'],
  ['Yuklangan hujjatda prompt injection', 'q4_report.md faylida yashirin ko\u2018rsatma bloklandi', 'high', 'kb-guard'],
  ['vLLM Node-02 kechikishi oshdi', 'p95 kechikish 480ms \u2192 1.4s', 'medium', 'inference-mesh'],
  ['Yangi API kaliti yaratildi', 'admin@nexusai.uz tomonidan CI/CD uchun', 'low', 'api-gateway'],
];
const insAlert = db.prepare('INSERT INTO alerts (id, title, detail, severity, source) VALUES (?,?,?,?,?)');
alerts.forEach((a) => insAlert.run(uid('alr'), a[0], a[1], a[2], a[3]));

for (let i = 6; i >= 0; i--) {
  const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
  db.prepare('INSERT INTO metrics (day, dau, requests, tokens, errors) VALUES (?,?,?,?,?)')
    .run(day, 120 + i * 34, 900 + i * 210, 180_000 + i * 41_000, i % 3);
}

indexDocument({
  userId: users[0].id,
  title: 'NexusAI xavfsizlik siyosati',
  filename: 'security-policy.md',
  mime: 'text/markdown',
  tags: ['xavfsizlik', 'siyosat'],
  text: `# NexusAI xavfsizlik siyosati

## Autentifikatsiya
Barcha administrator hisoblar uchun ikki bosqichli autentifikatsiya majburiy. FIDO2 apparat kalitlari
afzal ko'riladi, TOTP ilovalari zaxira usul sifatida qoladi. Parol kamida 12 belgidan iborat bo'lishi,
katta harf, kichik harf, raqam va maxsus belgi o'z ichiga olishi shart. Sessiya tokeni 12 soatdan keyin
avtomatik bekor qilinadi.

## Rate limiting
API darvozasi har bir IP uchun 15 daqiqada 600 so'rovga cheklanadi, autentifikatsiya endpointlari esa
40 so'rovga. Sliding-window hisoblagich Redis'da saqlanadi; fixed-window yondashuvi burst trafik
orqali chetlab o'tilishi mumkinligi sababli ishlatilmaydi.

## Ma'lumotlar saqlash
Zero-Data-Retention rejimida model provayderiga yuborilgan matnlar saqlanmaydi. Bilimlar bazasidagi
hujjatlar faqat egasi uchun ko'rinadi va o'chirilganda vektor bo'laklari ham kaskadli o'chiriladi.

## Audit
Har bir muhim amal hash-zanjirli jurnalga yoziladi. Bitta qator o'zgartirilsa, undan keyingi barcha
hash'lar buziladi va yaxlitlik tekshiruvi buzilgan ketma-ketlik raqamini qaytaradi.`,
});

indexDocument({
  userId: users[0].id,
  title: 'Q4 infratuzilma hisoboti',
  filename: 'q4-infra.md',
  mime: 'text/markdown',
  tags: ['infratuzilma', 'hisobot'],
  text: `# Q4 infratuzilma hisoboti

GPU klasteri A100-SXM4 tugunlaridan iborat, o'rtacha yuklama 72%, harorat 64°C atrofida barqaror.
vLLM dvigateli o'rtacha 24ms TTFT va soniyasiga 94 token ko'rsatkichini beradi.

Semantik keshlash joriy qilingandan so'ng takroriy so'rovlarning 42.6% i keshdan qaytmoqda,
kechikish 1.4 soniyadan 480 millisekundgacha qisqardi. Kesh xotirasi 68.4 GB / 256 GB band.

Keyingi chorakda rejalashtirilgan ishlar: Node-02 ni A100 dan H100 ga ko'chirish, post-quantum
kalit almashishni gibrid rejimda sinash va on-premise Llama klasterini 8 tugunga kengaytirish.`,
});

writeAudit({ actor: 'system', action: 'system.seed', resource: 'database', severity: 'info' });
[
  ['admin@nexusai.uz', 'auth.login', 'session', 'info'],
  ['madina@nexusai.uz', 'model.training_started', 'Mistral-Large-Uzbek', 'medium'],
  ['bobur@nexusai.uz', 'alert.status_changed', 'brute-force', 'medium'],
  ['noma\u2019lum', 'auth.login_failed', 'session', 'high'],
  ['admin@nexusai.uz', 'rbac.user_updated', 'dilnoza@nexusai.uz', 'high'],
  ['system', 'agent.patch', 'Self-Healing Patch Agent', 'high'],
].forEach(([actor, action, resource, severity]) =>
  writeAudit({ actor, action, resource, severity, ip: '10.0.4.' + Math.floor(Math.random() * 200) }));

console.log('\nTayyor. Sinov hisoblari:');
users.forEach((u) => console.log(`  ${u.email.padEnd(22)} ${u.pass.padEnd(18)} ${u.role}`));
console.log('\nEslatma: 2FA yoqilgan hisoblarda kod javobda dev_code sifatida qaytadi.\n');
