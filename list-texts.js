const Database = require('better-sqlite3');
const db = new Database('booktok.db');
const rows = db.prepare('SELECT title, author FROM books WHERE text_content IS NOT NULL').all();
console.log(`Books with full text (${rows.length}):`);
rows.forEach(r => console.log(`  ${r.title} by ${r.author}`));
db.close();