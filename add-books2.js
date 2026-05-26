const Database = require('better-sqlite3');
const db = new Database('booktok.db');

const newBooks = [
  // Fantasy
  ["The Name of the Wind", "Patrick Rothfuss", "Fantasy", 15, 18, "https://covers.openlibrary.org/b/olid/OL8479265W-M.jpg"],
  ["The Lies of Locke Lamora", "Scott Lynch", "Fantasy", 16, 18, "https://covers.openlibrary.org/b/olid/OL57380W-M.jpg"],
  ["The Princess Bride", "William Goldman", "Fantasy", 11, 18, "https://covers.openlibrary.org/b/olid/OL21548W-M.jpg"],
  ["Stardust", "Neil Gaiman", "Fantasy", 10, 15, "https://covers.openlibrary.org/b/olid/OL57381W-M.jpg"],
  ["Sabriel", "Garth Nix", "Fantasy", 12, 17, "https://covers.openlibrary.org/b/olid/OL57382W-M.jpg"],

  // Sci‑Fi
  ["Snow Crash", "Neal Stephenson", "Sci‑Fi", 15, 18, "https://covers.openlibrary.org/b/olid/OL148588W-M.jpg"],
  ["Neuromancer", "William Gibson", "Sci‑Fi", 16, 18, "https://covers.openlibrary.org/b/olid/OL78307W-M.jpg"],
  ["The Left Hand of Darkness", "Ursula K. Le Guin", "Sci‑Fi", 14, 18, "https://covers.openlibrary.org/b/olid/OL57383W-M.jpg"],
  ["Hyperion", "Dan Simmons", "Sci‑Fi", 16, 18, "https://covers.openlibrary.org/b/olid/OL57384W-M.jpg"],
  ["Foundation", "Isaac Asimov", "Sci‑Fi", 14, 18, "https://covers.openlibrary.org/b/olid/OL46332W-M.jpg"],

  // Dystopian
  ["Fahrenheit 451", "Ray Bradbury", "Dystopian", 13, 18, "https://covers.openlibrary.org/b/olid/OL57385W-M.jpg"],
  ["Brave New World", "Aldous Huxley", "Dystopian", 14, 18, "https://covers.openlibrary.org/b/olid/OL57386W-M.jpg"],
  ["Animal Farm", "George Orwell", "Dystopian", 12, 18, "https://covers.openlibrary.org/b/olid/OL1168082W-M.jpg"],
  ["Shatter Me", "Tahereh Mafi", "Dystopian", 13, 18, "https://covers.openlibrary.org/b/olid/OL17056526W-M.jpg"],
  ["The Darkest Minds", "Alexandra Bracken", "Dystopian", 13, 18, "https://covers.openlibrary.org/b/olid/OL17056527W-M.jpg"],

  // Romance
  ["The Fault in Our Stars", "John Green", "Romance", 13, 18, "https://covers.openlibrary.org/b/olid/OL19986424W-M.jpg"],
  ["Me Before You", "Jojo Moyes", "Romance", 14, 18, "https://covers.openlibrary.org/b/olid/OL17056528W-M.jpg"],
  ["The Notebook", "Nicholas Sparks", "Romance", 14, 18, "https://covers.openlibrary.org/b/olid/OL57387W-M.jpg"],
  ["Pride and Prejudice", "Jane Austen", "Romance", 12, 18, "https://covers.openlibrary.org/b/olid/OL66534W-M.jpg"],
  ["Emma", "Jane Austen", "Romance", 12, 18, "https://covers.openlibrary.org/b/olid/OL66535W-M.jpg"],

  // Mystery
  ["The Girl on the Train", "Paula Hawkins", "Mystery", 16, 18, "https://covers.openlibrary.org/b/olid/OL17056529W-M.jpg"],
  ["Gone Girl", "Gillian Flynn", "Mystery", 17, 18, "https://covers.openlibrary.org/b/olid/OL17056530W-M.jpg"],
  ["The Da Vinci Code", "Dan Brown", "Mystery", 14, 18, "https://covers.openlibrary.org/b/olid/OL57388W-M.jpg"],
  ["Murder on the Orient Express", "Agatha Christie", "Mystery", 12, 18, "https://covers.openlibrary.org/b/olid/OL57389W-M.jpg"],
  ["The Curious Incident of the Dog in the Night-Time", "Mark Haddon", "Mystery", 11, 16, "https://covers.openlibrary.org/b/olid/OL57390W-M.jpg"],

  // Horror
  ["The Haunting of Hill House", "Shirley Jackson", "Horror", 14, 18, "https://covers.openlibrary.org/b/olid/OL57391W-M.jpg"],
  ["It", "Stephen King", "Horror", 16, 18, "https://covers.openlibrary.org/b/olid/OL57392W-M.jpg"],
  ["The Exorcist", "William Peter Blatty", "Horror", 16, 18, "https://covers.openlibrary.org/b/olid/OL57393W-M.jpg"],
  ["House of Leaves", "Mark Z. Danielewski", "Horror", 16, 18, "https://covers.openlibrary.org/b/olid/OL17056531W-M.jpg"],
  ["Bird Box", "Josh Malerman", "Horror", 15, 18, "https://covers.openlibrary.org/b/olid/OL17056532W-M.jpg"],

  // Historical Fiction
  ["The Pillars of the Earth", "Ken Follett", "Historical Fiction", 16, 18, "https://covers.openlibrary.org/b/olid/OL57394W-M.jpg"],
  ["All the Light We Cannot See", "Anthony Doerr", "Historical Fiction", 14, 18, "https://covers.openlibrary.org/b/olid/OL17056533W-M.jpg"],
  ["The Help", "Kathryn Stockett", "Historical Fiction", 14, 18, "https://covers.openlibrary.org/b/olid/OL57395W-M.jpg"],
  ["Memoirs of a Geisha", "Arthur Golden", "Historical Fiction", 15, 18, "https://covers.openlibrary.org/b/olid/OL57396W-M.jpg"],
  ["A Tale of Two Cities", "Charles Dickens", "Historical Fiction", 14, 18, "https://covers.openlibrary.org/b/olid/OL57397W-M.jpg"],

  // Non‑Fiction
  ["Outliers", "Malcolm Gladwell", "Non‑Fiction", 14, 18, "https://covers.openlibrary.org/b/olid/OL57398W-M.jpg"],
  ["Freakonomics", "Steven D. Levitt", "Non‑Fiction", 14, 18, "https://covers.openlibrary.org/b/olid/OL57399W-M.jpg"],
  ["The Tipping Point", "Malcolm Gladwell", "Non‑Fiction", 14, 18, "https://covers.openlibrary.org/b/olid/OL57400W-M.jpg"],
  ["Sapiens", "Yuval Noah Harari", "Non‑Fiction", 14, 18, "https://covers.openlibrary.org/b/olid/OL17925477W-M.jpg"], // duplicate? It's in first list, but IGNORE will skip
  ["The Wright Brothers", "David McCullough", "Non‑Fiction", 14, 18, "https://covers.openlibrary.org/b/olid/OL17056534W-M.jpg"],

  // Adventure
  ["Into the Wild", "Jon Krakauer", "Adventure", 14, 18, "https://covers.openlibrary.org/b/olid/OL57401W-M.jpg"],
  ["The Lost City of Z", "David Grann", "Adventure", 14, 18, "https://covers.openlibrary.org/b/olid/OL57402W-M.jpg"],
  ["The Odyssey", "Homer", "Adventure", 12, 18, "https://covers.openlibrary.org/b/olid/OL57403W-M.jpg"],
  ["Robinson Crusoe", "Daniel Defoe", "Adventure", 10, 18, "https://covers.openlibrary.org/b/olid/OL57404W-M.jpg"],
  ["The Count of Monte Cristo", "Alexandre Dumas", "Adventure", 14, 18, "https://covers.openlibrary.org/b/olid/OL57405W-M.jpg"],

  // Comedy
  ["Good Omens", "Neil Gaiman & Terry Pratchett", "Comedy", 13, 18, "https://covers.openlibrary.org/b/olid/OL57406W-M.jpg"],
  ["Lamb: The Gospel According to Biff, Christ's Childhood Pal", "Christopher Moore", "Comedy", 16, 18, "https://covers.openlibrary.org/b/olid/OL17056535W-M.jpg"],
  ["A Confederacy of Dunces", "John Kennedy Toole", "Comedy", 15, 18, "https://covers.openlibrary.org/b/olid/OL57407W-M.jpg"],
  ["Three Men in a Boat", "Jerome K. Jerome", "Comedy", 12, 18, "https://covers.openlibrary.org/b/olid/OL57408W-M.jpg"],
  ["The Hitchhiker’s Guide to the Galaxy", "Douglas Adams", "Comedy", 12, 18, "https://covers.openlibrary.org/b/olid/OL17925474W-M.jpg"]  // already in original? It's there. IGNORE will skip.
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