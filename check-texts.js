const Database = require('better-sqlite3');
const db = new Database('booktok.db');
const ready = db.prepare('SELECT COUNT(*) AS cnt FROM books WHERE text_content IS NOT NULL').get();
console.log(`✅ Books with full text: ${ready.cnt}`);
const missing = db.prepare('SELECT COUNT(*) AS cnt FROM books WHERE text_content IS NULL').get();
console.log(`⏳ Books still missing: ${missing.cnt}`);
db.close();