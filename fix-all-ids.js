const db = require('./database/setup');

// Keep only the real-looking IDs (not ending in common fake patterns)
const fakePatterns = ['QAAJ', 'AAAAJ', 'QBAJ', 'QEACAAJ', 'gEACAAJ', 'ngEACAAJ', 'rgEACAAJ', 'AQAAMAAJ', 'AAAAMAAJ', 'GWAACAAJ', 'kdQAAACAAJ', 'swEACAAJ', 'stwEACAAJ', 'LGwAACAAJ', 'InQEACAAJ', 'EAAAQBAJ', 'QEAAAQBAJ', '0QEACAAJ'];

for (const pattern of fakePatterns) {
  const result = db.prepare(`UPDATE books SET google_books_id = NULL WHERE google_books_id LIKE '%${pattern}'`).run();
  if (result.changes > 0) console.log(`🧹 Cleared ${result.changes} IDs matching "${pattern}"`);
}

const remaining = db.prepare('SELECT COUNT(*) as c FROM books WHERE google_books_id IS NOT NULL').get().c;
console.log(`\n✅ Remaining real IDs: ${remaining}`);
process.exit(0);