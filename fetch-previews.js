const https = require('https');
const Database = require('better-sqlite3');
require('dotenv').config();   // ← THIS WAS MISSING, NOW IT LOADS YOUR API KEY

const db = new Database('booktok.db');

// Ensure column exists
try {
  db.exec('ALTER TABLE books ADD COLUMN google_books_id TEXT DEFAULT NULL');
  console.log('✓ google_books_id column ready');
} catch(e) {}

// Helper: GET JSON from Google Books API
function googleGET(query) {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const path = `/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1&key=${apiKey}`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.googleapis.com',
      path: path,
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function fetchPreviewForBook(bookId) {
  const book = db.prepare('SELECT id, title, author FROM books WHERE id = ? AND text_content IS NULL AND google_books_id IS NULL').get(bookId);
  if (!book) return false;

  const query = `${book.title} ${book.author}`;
  try {
    const result = await googleGET(query);
    if (!result.items || result.items.length === 0) {
      console.log(`❌ No Google Books match for "${book.title}"`);
      return false;
    }

    const item = result.items[0];
    const isEmbeddable = item.accessInfo?.embeddable;
    if (!isEmbeddable) {
      console.log(`❌ Not embeddable: "${book.title}"`);
      return false;
    }

    const googleId = item.id;
    db.prepare('UPDATE books SET google_books_id = ? WHERE id = ?').run(googleId, book.id);
    console.log(`✅ Preview ID saved: "${book.title}"`);
    return true;
  } catch (err) {
    console.error(`⚠️ Error for "${book.title}": ${err.message}`);
    return false;
  }
}

(async () => {
  const booksWithoutPreview = db.prepare('SELECT id FROM books WHERE text_content IS NULL AND google_books_id IS NULL').all();
  console.log(`Found ${booksWithoutPreview.length} books without preview.`);

  let success = 0;
  for (const b of booksWithoutPreview) {
    const ok = await fetchPreviewForBook(b.id);
    if (ok) success++;
    // Be polite to the API (1.2 seconds between requests)
    await new Promise(resolve => setTimeout(resolve, 1200));
  }

  console.log(`\nDone. Successfully fetched ${success} Google previews.`);
  db.close();
})();