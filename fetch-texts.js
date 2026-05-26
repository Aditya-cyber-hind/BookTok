const http = require('http');
const https = require('https');
const { URL } = require('url');
const Database = require('better-sqlite3');
const db = new Database('booktok.db');

// Ensure the text_content column exists
try {
  db.exec('ALTER TABLE books ADD COLUMN text_content TEXT DEFAULT NULL');
  console.log('✓ text_content column ready');
} catch(e) { /* already exists */ }

// Helper: GET a URL using either http or https, follow redirects up to 5 times
function httpGet(urlStr, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const doGet = (currentUrl, remaining) => {
      const parsed = new URL(currentUrl);
      const mod = parsed.protocol === 'https:' ? https : http;
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: { 'User-Agent': 'BookTok/1.0' }
      };

      const req = mod.get(options, (res) => {
        // Redirect
        if (res.statusCode >= 301 && res.statusCode <= 308 && res.headers.location) {
          if (remaining <= 0) {
            reject(new Error('Too many redirects'));
            return;
          }
          // Resolve relative redirect against current URL
          const redirectUrl = new URL(res.headers.location, currentUrl).href;
          doGet(redirectUrl, remaining - 1);
          return;
        }
        // Normal response
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.end();
    };
    doGet(urlStr, maxRedirects);
  });
}

async function fetchTextForBook(bookId) {
  const book = db.prepare('SELECT id, title, author FROM books WHERE id = ? AND text_content IS NULL').get(bookId);
  if (!book) return false;

  const query = encodeURIComponent(`${book.title} ${book.author}`);
  try {
    const searchUrl = `https://gutendex.com/books?search=${query}`;
    const searchResult = await httpGet(searchUrl);
    const searchData = JSON.parse(searchResult);

    if (!searchData.results || searchData.results.length === 0) {
      console.log(`❌ No Gutenberg match for "${book.title}"`);
      return false;
    }

    const gb = searchData.results[0];
    const textUrl = gb.formats?.['text/plain']
                  || gb.formats?.['text/plain; charset=utf-8']
                  || gb.formats?.['text/plain; charset=us-ascii']
                  || gb.formats?.['text/html']
                  || null;

    if (!textUrl) {
      console.log(`❌ No text format for "${book.title}"`);
      return false;
    }

    console.log(`📥 Fetching "${book.title}" from ${textUrl}`);
    const text = await httpGet(textUrl);

    db.prepare('UPDATE books SET text_content = ? WHERE id = ?').run(text, book.id);
    console.log(`✅ Stored "${book.title}" (${(text.length / 1024).toFixed(1)} KB)`);
    return true;
  } catch (err) {
    console.error(`⚠️ Error fetching "${book.title}": ${err.message}`);
    return false;
  }
}

(async () => {
  const booksWithoutText = db.prepare('SELECT id FROM books WHERE text_content IS NULL').all();
  console.log(`Found ${booksWithoutText.length} books without text content.`);

  let success = 0;
  for (const b of booksWithoutText) {
    const ok = await fetchTextForBook(b.id);
    if (ok) success++;
    // Be kind to the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\nDone. Successfully fetched ${success} books.`);
  db.close();
})();