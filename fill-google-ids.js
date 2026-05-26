const https = require('https');
const Database = require('better-sqlite3');
require('dotenv').config();
const db = new Database('booktok.db');

function googleGET(path) {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  return new Promise((resolve, reject) => {
    https.get(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(path)}&maxResults=1&key=${apiKey}`, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

(async () => {
  const booksMissing = db.prepare('SELECT id, title, author FROM books WHERE google_books_id IS NULL').all();
  console.log(`Found ${booksMissing.length} books without Google Books ID.`);

  let success = 0;
  for (const book of booksMissing) {
    try {
      const result = await googleGET(`${book.title} ${book.author}`);
      if (result.items && result.items.length > 0) {
        const id = result.items[0].id;
        db.prepare('UPDATE books SET google_books_id = ? WHERE id = ?').run(id, book.id);
        console.log(`✅ Saved ID for "${book.title}"`);
        success++;
      } else {
        console.log(`❌ No match for "${book.title}"`);
      }
    } catch (e) {
      console.log(`⚠️ Error for "${book.title}": ${e.message}`);
    }
    // Google API rate limit – 1 request per second
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
  console.log(`\nDone. Added ${success} IDs.`);
  db.close();
})();