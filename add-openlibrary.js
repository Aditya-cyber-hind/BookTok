const https = require('https');
const db = require('./database/setup');

const books = db.prepare('SELECT id, title, author FROM books').all();

// Add openlibrary_id column if it doesn't exist
try { db.exec('ALTER TABLE books ADD COLUMN openlibrary_id TEXT DEFAULT NULL'); } catch(e) {}

function searchOpenLibrary(book) {
  return new Promise((resolve) => {
    const query = encodeURIComponent(`${book.title} ${book.author}`);
    const url = `https://openlibrary.org/search.json?q=${query}&limit=1`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.docs && json.docs[0]) {
            const olid = json.docs[0].cover_edition_key || json.docs[0].edition_key?.[0];
            if (olid) {
              db.prepare('UPDATE books SET openlibrary_id = ? WHERE id = ?').run(olid, book.id);
              console.log(`✅ ${book.title} → ${olid}`);
            } else {
              console.log(`⚠️ ${book.title} → No edition key`);
            }
          } else {
            console.log(`⚠️ ${book.title} → Not found`);
          }
        } catch(e) {
          console.log(`❌ ${book.title} → Error`);
        }
        resolve();
      });
    }).on('error', () => {
      console.log(`❌ ${book.title} → Network error`);
      resolve();
    });
  });
}

async function main() {
  for (const book of books) {
    await searchOpenLibrary(book);
    await new Promise(r => setTimeout(r, 300));
  }
  
  const total = db.prepare('SELECT COUNT(*) as c FROM books WHERE openlibrary_id IS NOT NULL').get().c;
  console.log(`\n📚 Books with Open Library IDs: ${total}/${books.length}`);
  process.exit(0);
}

main();