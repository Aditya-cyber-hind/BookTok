const https = require('https');
const db = require('./database/setup');
require('dotenv').config();

const API_KEY = process.env.GOOGLE_BOOKS_API_KEY;

if (!API_KEY) {
  console.log('❌ No GOOGLE_BOOKS_API_KEY in .env file!');
  console.log('Add your key to .env and try again.');
  process.exit(1);
}

const books = db.prepare("SELECT id, title, author FROM books WHERE google_books_id IS NULL OR google_books_id LIKE '%AAAA%' OR google_books_id LIKE '%QAAJ%'").all();

console.log(`🔍 Fetching real IDs for ${books.length} books...\n`);

function fetchGoogleID(book) {
  return new Promise((resolve) => {
    const query = encodeURIComponent(`${book.title} ${book.author}`);
    const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1&key=${API_KEY}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.items && json.items[0]) {
            const gid = json.items[0].id;
            db.prepare('UPDATE books SET google_books_id = ? WHERE id = ?').run(gid, book.id);
            console.log(`✅ ${book.title} → ${gid}`);
          } else {
            console.log(`⚠️ ${book.title} → Not found on Google Books`);
          }
        } catch(e) {
          console.log(`❌ ${book.title} → Error parsing response`);
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
    await fetchGoogleID(book);
    await new Promise(r => setTimeout(r, 1000));
  }
  
  const total = db.prepare('SELECT COUNT(*) as c FROM books WHERE google_books_id IS NOT NULL').get().c;
  console.log(`\n📚 Books with previews: ${total}`);
  process.exit(0);
}

main();