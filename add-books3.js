const Database = require('better-sqlite3');
const db = new Database('booktok.db');

const newBooks = [
  // ── Thriller ──
  ["The Silent Patient", "Alex Michaelides", "Thriller", 16, 18, "https://covers.openlibrary.org/b/olid/OL19841734W-M.jpg"],
  ["The Girl with the Dragon Tattoo", "Stieg Larsson", "Thriller", 17, 18, "https://covers.openlibrary.org/b/olid/OL585562W-M.jpg"],
  ["Gone Girl", "Gillian Flynn", "Thriller", 17, 18, "https://covers.openlibrary.org/b/olid/OL17056530W-M.jpg"],
  ["The Da Vinci Code", "Dan Brown", "Thriller", 14, 18, "https://covers.openlibrary.org/b/olid/OL57388W-M.jpg"],
  ["Sharp Objects", "Gillian Flynn", "Thriller", 17, 18, "https://covers.openlibrary.org/b/olid/OL17056536W-M.jpg"],

  // ── Classics ──
  ["To Kill a Mockingbird", "Harper Lee", "Classics", 13, 18, "https://covers.openlibrary.org/b/olid/OL31450W-M.jpg"],
  ["1984", "George Orwell", "Classics", 14, 18, "https://covers.openlibrary.org/b/olid/OL1168082W-M.jpg"],   // already exists? IGNORE handles it
  ["The Great Gatsby", "F. Scott Fitzgerald", "Classics", 14, 18, "https://covers.openlibrary.org/b/olid/OL46825W-M.jpg"],
  ["Moby Dick", "Herman Melville", "Classics", 15, 18, "https://covers.openlibrary.org/b/olid/OL57409W-M.jpg"],
  ["Jane Eyre", "Charlotte Brontë", "Classics", 13, 18, "https://covers.openlibrary.org/b/olid/OL57410W-M.jpg"],
  ["Wuthering Heights", "Emily Brontë", "Classics", 14, 18, "https://covers.openlibrary.org/b/olid/OL57411W-M.jpg"],
  ["Little Women", "Louisa May Alcott", "Classics", 10, 16, "https://covers.openlibrary.org/b/olid/OL57412W-M.jpg"],

  // ── Poetry ──
  ["The Sun and Her Flowers", "Rupi Kaur", "Poetry", 14, 18, "https://covers.openlibrary.org/b/olid/OL17056537W-M.jpg"],
  ["Milk and Honey", "Rupi Kaur", "Poetry", 14, 18, "https://covers.openlibrary.org/b/olid/OL17056538W-M.jpg"],
  ["Where the Sidewalk Ends", "Shel Silverstein", "Poetry", 6, 12, "https://covers.openlibrary.org/b/olid/OL57413W-M.jpg"],
  ["Leaves of Grass", "Walt Whitman", "Poetry", 14, 18, "https://covers.openlibrary.org/b/olid/OL57414W-M.jpg"],
  ["A Light in the Attic", "Shel Silverstein", "Poetry", 6, 12, "https://covers.openlibrary.org/b/olid/OL57415W-M.jpg"],

  // ── Graphic Novel ──
  ["Maus", "Art Spiegelman", "Graphic Novel", 14, 18, "https://covers.openlibrary.org/b/olid/OL57416W-M.jpg"],
  ["Persepolis", "Marjane Satrapi", "Graphic Novel", 14, 18, "https://covers.openlibrary.org/b/olid/OL57417W-M.jpg"],
  ["Watchmen", "Alan Moore", "Graphic Novel", 16, 18, "https://covers.openlibrary.org/b/olid/OL57418W-M.jpg"],
  ["The Adventure Zone: Here There Be Gerblins", "Clint McElroy", "Graphic Novel", 13, 18, "https://covers.openlibrary.org/b/olid/OL17056539W-M.jpg"],
  ["Nimona", "Noelle Stevenson", "Graphic Novel", 12, 17, "https://covers.openlibrary.org/b/olid/OL17056540W-M.jpg"],

  // ── Biography ──
  ["The Diary of a Young Girl", "Anne Frank", "Biography", 12, 18, "https://covers.openlibrary.org/b/olid/OL1092472W-M.jpg"],
  ["I Am Malala", "Malala Yousafzai", "Biography", 12, 18, "https://covers.openlibrary.org/b/olid/OL17056541W-M.jpg"],
  ["Steve Jobs", "Walter Isaacson", "Biography", 14, 18, "https://covers.openlibrary.org/b/olid/OL16113825W-M.jpg"],
  ["Becoming", "Michelle Obama", "Biography", 13, 18, "https://covers.openlibrary.org/b/olid/OL17925474W-M.jpg"],   // already added in first script, but skip
  ["Educated", "Tara Westover", "Biography", 14, 18, "https://covers.openlibrary.org/b/olid/OL17925475W-M.jpg"],

  // ── Self‑Help ──
  ["The 7 Habits of Highly Effective Teens", "Sean Covey", "Self‑Help", 12, 18, "https://covers.openlibrary.org/b/olid/OL17925476W-M.jpg"],
  ["How to Win Friends and Influence People", "Dale Carnegie", "Self‑Help", 14, 18, "https://covers.openlibrary.org/b/olid/OL57419W-M.jpg"],
  ["Atomic Habits", "James Clear", "Self‑Help", 13, 18, "https://covers.openlibrary.org/b/olid/OL17056542W-M.jpg"],
  ["The Power of Now", "Eckhart Tolle", "Self‑Help", 15, 18, "https://covers.openlibrary.org/b/olid/OL57420W-M.jpg"],
  ["Think and Grow Rich", "Napoleon Hill", "Self‑Help", 15, 18, "https://covers.openlibrary.org/b/olid/OL57421W-M.jpg"],

  // ── Science ──
  ["A Brief History of Time", "Stephen Hawking", "Science", 14, 18, "https://covers.openlibrary.org/b/olid/OL57422W-M.jpg"],
  ["Cosmos", "Carl Sagan", "Science", 14, 18, "https://covers.openlibrary.org/b/olid/OL57423W-M.jpg"],
  ["The Selfish Gene", "Richard Dawkins", "Science", 15, 18, "https://covers.openlibrary.org/b/olid/OL57424W-M.jpg"],
  ["The Immortal Life of Henrietta Lacks", "Rebecca Skloot", "Science", 14, 18, "https://covers.openlibrary.org/b/olid/OL17056543W-M.jpg"],
  ["Sapiens", "Yuval Noah Harari", "Science", 14, 18, "https://covers.openlibrary.org/b/olid/OL17925477W-M.jpg"]   // also non‑fiction, double‑genre possible, but we'll keep Science
];

const insert = db.prepare(`
  INSERT OR IGNORE INTO books (title, author, genre, min_age, max_age, cover_url)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const existing = db.prepare('SELECT title, author FROM books').all();
const existingSet = new Set(existing.map(b => `${b.title}|||${b.author}`));

let added = 0;
for (const book of newBooks) {
  const key = `${book[0]}|||${book[1]}`;
  if (!existingSet.has(key)) {
    insert.run(...book);
    existingSet.add(key);
    added++;
  }
}

console.log(`Added ${added} new books.`);
db.close();