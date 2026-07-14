const https = require('https');
const db = require('./database/setup');

const books = db.prepare('SELECT id, title, author FROM books WHERE google_books_id IS NULL').all();

async function fetchGoogleID(book) {
  return new Promise((resolve) => {
    const query = encodeURIComponent(`${book.title} ${book.author}`);
    const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1&key=${process.env.GOOGLE_BOOKS_API_KEY || ''}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.items && json.items[0]) {
            const id = json.items[0].id;
            db.prepare('UPDATE books SET google_books_id = ? WHERE id = ?').run(id, book.id);
            console.log(`✅ ${book.title} → ID: ${id}`);
          } else {
            console.log(`❌ ${book.title} → Not found`);
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
    await fetchGoogleID(book);
    await new Promise(r => setTimeout(r, 500)); // rate limit
  }
  console.log('\n✅ Done!');
  const total = db.prepare('SELECT COUNT(*) as c FROM books WHERE google_books_id IS NOT NULL').get().c;
  console.log(`📚 Books with previews: ${total}/${books.length}`);
  process.exit(0);
}

main();