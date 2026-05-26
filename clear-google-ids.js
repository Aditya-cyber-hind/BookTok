const Database = require('better-sqlite3');
const db = new Database('booktok.db');
db.exec('UPDATE books SET google_books_id = NULL');
console.log('All Google Books IDs cleared.');
db.close();