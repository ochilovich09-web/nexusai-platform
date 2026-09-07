/**
 * Vercel serverless kirish nuqtasi.
 * Express ilovasi server/src/index.js dan olinadi — u yerda VERCEL o'zgaruvchisi
 * borligi uchun app.listen() chaqirilmaydi, faqat `app` eksport qilinadi.
 *
 * Baza: TURSO_DATABASE_URL majburiy. Vercel'da lokal disk vaqtinchalik,
 * shuning uchun SQLite fayli emas, Turso (bulut libSQL) ishlatiladi.
 */
export { default } from '../server/src/index.js';
