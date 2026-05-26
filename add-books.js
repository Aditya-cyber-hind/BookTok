const Database = require('better-sqlite3');
const db = new Database('booktok.db');

// Books to add (title, author, genre, min_age, max_age, cover_url)
const newBooks = [
  // Fantasy
  ["A Wizard of Earthsea", "Ursula K. Le Guin", "Fantasy", 10, 15, "https://covers.openlibrary.org/b/olid/OL57367W-M.jpg"],
  ["The Golden Compass", "Philip Pullman", "Fantasy", 10, 15, "https://covers.openlibrary.org/b/olid/OL29587W-M.jpg"],
  ["Artemis Fowl", "Eoin Colfer", "Fantasy", 10, 14, "https://covers.openlibrary.org/b/olid/OL57297W-M.jpg"],
  ["Howl's Moving Castle", "Diana Wynne Jones", "Fantasy", 10, 15, "https://covers.openlibrary.org/b/olid/OL267232W-M.jpg"],
  ["The Last Unicorn", "Peter S. Beagle", "Fantasy", 12, 18, "https://covers.openlibrary.org/b/olid/OL57368W-M.jpg"],

  // Sci‑Fi
  ["Dune", "Frank Herbert", "Sci‑Fi", 14, 18, "https://covers.openlibrary.org/b/olid/OL89562W-M.jpg"],
  ["Ready Player One", "Ernest Cline", "Sci‑Fi", 13, 18, "https://covers.openlibrary.org/b/olid/OL16804624W-M.jpg"],
  ["The Giver", "Lois Lowry", "Sci‑Fi", 10, 14, "https://covers.openlibrary.org/b/olid/OL3930557W-M.jpg"],
  ["I, Robot", "Isaac Asimov", "Sci‑Fi", 13, 18, "https://covers.openlibrary.org/b/olid/OL266042W-M.jpg"],
  ["Ender’s Shadow", "Orson Scott Card", "Sci‑Fi", 12, 18, "https://covers.openlibrary.org/b/olid/OL57373W-M.jpg"],

  // Dystopian
  ["The Maze Runner", "James Dashner", "Dystopian", 12, 18, "https://covers.openlibrary.org/b/olid/OL16113826W-M.jpg"],
  ["Legend", "Marie Lu", "Dystopian", 13, 18, "https://covers.openlibrary.org/b/olid/OL17056512W-M.jpg"],
  ["Red Queen", "Victoria Aveyard", "Dystopian", 13, 18, "https://covers.openlibrary.org/b/olid/OL19997780W-M.jpg"],
  ["The Selection", "Kiera Cass", "Dystopian", 13, 18, "https://covers.openlibrary.org/b/olid/OL17083212W-M.jpg"],
  ["Matched", "Ally Condie", "Dystopian", 12, 17, "https://covers.openlibrary.org/b/olid/OL15991282W-M.jpg"],

  // Romance
  ["Eleanor & Park", "Rainbow Rowell", "Romance", 13, 18, "https://covers.openlibrary.org/b/olid/OL20340650W-M.jpg"],
  ["Simon vs. the Homo Sapiens Agenda", "Becky Albertalli", "Romance", 13, 18, "https://covers.openlibrary.org/b/olid/OL17083147W-M.jpg"],
  ["Anna and the French Kiss", "Stephanie Perkins", "Romance", 12, 17, "https://covers.openlibrary.org/b/olid/OL15932899W-M.jpg"],
  ["The Sun Is Also a Star", "Nicola Yoon", "Romance", 13, 18, "https://covers.openlibrary.org/b/olid/OL17083149W-M.jpg"],
  ["Love & Gelato", "Jenna Evans Welch", "Romance", 12, 17, "https://covers.openlibrary.org/b/olid/OL17925473W-M.jpg"],

  // Mystery
  ["The Name of the Star", "Maureen Johnson", "Mystery", 13, 18, "https://covers.openlibrary.org/b/olid/OL16342769W-M.jpg"],
  ["One of Us Is Lying", "Karen M. McManus", "Mystery", 13, 18, "https://covers.openlibrary.org/b/olid/OL17732204W-M.jpg"],
  ["Truly Devious", "Maureen Johnson", "Mystery", 13, 18, "https://covers.openlibrary.org/b/olid/OL19648138W-M.jpg"],
  ["The Inheritance Games", "Jennifer Lynn Barnes", "Mystery", 12, 17, "https://covers.openlibrary.org/b/olid/OL20739924W-M.jpg"],
  ["A Good Girl's Guide to Murder", "Holly Jackson", "Mystery", 13, 18, "https://covers.openlibrary.org/b/olid/OL20739925W-M.jpg"],

  // Horror
  ["The Graveyard Book", "Neil Gaiman", "Horror", 10, 14, "https://covers.openlibrary.org/b/olid/OL57374W-M.jpg"],
  ["The Diviners", "Libba Bray", "Horror", 14, 18, "https://covers.openlibrary.org/b/olid/OL16473943W-M.jpg"],
  ["Slasher Girls & Monster Boys", "April Genevieve Tucholke", "Horror", 14, 18, "https://covers.openlibrary.org/b/olid/OL17056513W-M.jpg"],
  ["Asylum", "Madeleine Roux", "Horror", 14, 18, "https://covers.openlibrary.org/b/olid/OL17056514W-M.jpg"],
  ["The Monstrumologist", "Rick Yancey", "Horror", 14, 18, "https://covers.openlibrary.org/b/olid/OL17056515W-M.jpg"],

  // Historical Fiction
  ["The Nightingale", "Kristin Hannah", "Historical Fiction", 14, 18, "https://covers.openlibrary.org/b/olid/OL17056516W-M.jpg"],
  ["Salt to the Sea", "Ruta Sepetys", "Historical Fiction", 13, 18, "https://covers.openlibrary.org/b/olid/OL17056517W-M.jpg"],
  ["Code Name Verity", "Elizabeth Wein", "Historical Fiction", 13, 18, "https://covers.openlibrary.org/b/olid/OL17056518W-M.jpg"],
  ["Between Shades of Gray", "Ruta Sepetys", "Historical Fiction", 13, 18, "https://covers.openlibrary.org/b/olid/OL17056519W-M.jpg"],
  ["The War That Saved My Life", "Kimberly Brubaker Bradley", "Historical Fiction", 9, 14, "https://covers.openlibrary.org/b/olid/OL17056520W-M.jpg"],

  // Non‑Fiction
  ["Becoming", "Michelle Obama", "Non‑Fiction", 13, 18, "https://covers.openlibrary.org/b/olid/OL17925474W-M.jpg"],
  ["Educated", "Tara Westover", "Non‑Fiction", 14, 18, "https://covers.openlibrary.org/b/olid/OL17925475W-M.jpg"],
  ["The 7 Habits of Highly Effective Teens", "Sean Covey", "Non‑Fiction", 12, 18, "https://covers.openlibrary.org/b/olid/OL17925476W-M.jpg"],
  ["The Diary of a Young Girl", "Anne Frank", "Non‑Fiction", 12, 18, "https://covers.openlibrary.org/b/olid/OL1092472W-M.jpg"],
  ["Sapiens", "Yuval Noah Harari", "Non‑Fiction", 14, 18, "https://covers.openlibrary.org/b/olid/OL17925477W-M.jpg"],

  // Adventure
  ["The Alchemist", "Paulo Coelho", "Adventure", 12, 18, "https://covers.openlibrary.org/b/olid/OL57375W-M.jpg"],
  ["The Martian Chronicles", "Ray Bradbury", "Adventure", 12, 18, "https://covers.openlibrary.org/b/olid/OL57376W-M.jpg"],
  ["Around the World in Eighty Days", "Jules Verne", "Adventure", 10, 15, "https://covers.openlibrary.org/b/olid/OL57377W-M.jpg"],
  ["The Call of the Wild", "Jack London", "Adventure", 10, 15, "https://covers.openlibrary.org/b/olid/OL57378W-M.jpg"],
  ["King Solomon's Mines", "H. Rider Haggard", "Adventure", 12, 18, "https://covers.openlibrary.org/b/olid/OL57379W-M.jpg"],

  // Comedy
  ["The Rosie Project", "Graeme Simsion", "Comedy", 13, 18, "https://covers.openlibrary.org/b/olid/OL17056521W-M.jpg"],
  ["Hyperbole and a Half", "Allie Brosh", "Comedy", 14, 18, "https://covers.openlibrary.org/b/olid/OL17056522W-M.jpg"],
  ["Yes Please", "Amy Poehler", "Comedy", 14, 18, "https://covers.openlibrary.org/b/olid/OL17056523W-M.jpg"],
  ["Let's Pretend This Never Happened", "Jenny Lawson", "Comedy", 14, 18, "https://covers.openlibrary.org/b/olid/OL17056524W-M.jpg"],
  ["Dad Is Fat", "Jim Gaffigan", "Comedy", 13, 18, "https://covers.openlibrary.org/b/olid/OL17056525W-M.jpg"]
];

const insert = db.prepare(`
  INSERT OR IGNORE INTO books (title, author, genre, min_age, max_age, cover_url)
  VALUES (?, ?, ?, ?, ?, ?)
`);

// Use a unique constraint: we consider (title, author) to be unique.
// But our table doesn't have that constraint, so we check manually.
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