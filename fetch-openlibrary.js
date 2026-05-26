const https = require('https');
const Database = require('better-sqlite3');
const db = new Database('booktok.db');

try {
  db.exec('ALTER TABLE books ADD COLUMN text_content TEXT DEFAULT NULL');
  console.log('✓ text_content column ready');
} catch(e) {}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : require('http');
    mod.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const newUrl = new URL(res.headers.location, url).href;
        httpGet(newUrl).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function fetchPublicDomainText(bookId) {
  const book = db.prepare('SELECT id, title, author FROM books WHERE id = ? AND text_content IS NULL').get(bookId);
  if (!book) return false;

  const query = encodeURIComponent(`${book.title} ${book.author}`);
  try {
    const searchUrl = `https://openlibrary.org/search.json?q=${query}&limit=1`;
    const searchResult = await httpGet(searchUrl);
    const searchData = JSON.parse(searchResult);

    if (!searchData.docs || searchData.docs.length === 0) return false;

    const doc = searchData.docs[0];
    // Check if the book is public domain (some have a flag, but not always reliable)
    // Instead, we'll only try books where Open Library explicitly says "public_domain": true
    // In the search result, there's no direct flag, so we'll skip this approach for now.
    // For safety, this script will not download anything. We'll rely on Gutenberg.
    console.log(`❌ Skipping "${book.title}" – only public domain sources allowed.`);
    return false;
  } catch (err) {
    console.error(`⚠️ Error for "${book.title}": ${err.message}`);
    return false;
  }
}

// Since we can't reliably determine public domain from Open Library search, this script does nothing.
// We'll keep it as a placeholder. Use Gutenberg for all free texts.
console.log('This script is deactivated to respect copyright. Use Gutenberg instead.');
db.close();