const https = require('https');
const db = require('./database/setup');

const gutenbergMap = {
  "Pride and Prejudice": 1342,
  "Frankenstein": 84,
  "Dracula": 345,
  "The Adventures of Sherlock Holmes": 1661,
  "Alice's Adventures in Wonderland": 11,
  "The Picture of Dorian Gray": 174,
  "The Strange Case of Dr. Jekyll and Mr. Hyde": 43,
  "Moby Dick": 2701,
  "A Tale of Two Cities": 98,
  "Treasure Island": 120,
  "The Wonderful Wizard of Oz": 55,
  "The Adventures of Tom Sawyer": 74,
  "Adventures of Huckleberry Finn": 76,
  "The Count of Monte Cristo": 1184,
  "Jane Eyre": 1260,
  "Wuthering Heights": 768,
  "Great Expectations": 1400,
  "Peter Pan": 16,
  "The Secret Garden": 25344,
  "A Christmas Carol": 46,
  "Little Women": 2814,
  "The Jungle Book": 4300,
  "Anne of Green Gables": 45,
  "The Wind in the Willows": 27827,
  "The Scarlet Letter": 25525,
  "Oliver Twist": 730,
  "Grimms' Fairy Tales": 2591,
  "Crime and Punishment": 2554,
  "The Odyssey": 1727,
  "The Iliad": 6130,
  "The Metamorphosis": 5200,
  "Gulliver's Travels": 829,
  "The Three Musketeers": 2542,
  "Twenty Thousand Leagues Under the Sea": 1259,
  "Around the World in 80 Days": 103,
  "The War of the Worlds": 36,
  "The Time Machine": 35,
  "The Invisible Man": 5230,
  "The Island of Doctor Moreau": 15238,
  "Uncle Tom's Cabin": 203,
  "Emma": 158,
  "Sense and Sensibility": 110,
  "Northanger Abbey": 121,
  "Persuasion": 105,
  "Mansfield Park": 946,
  "Les Miserables": 135,
  "The Brothers Karamazov": 28054,
  "The Works of Edgar Allan Poe": 2147,
  "Don Quixote": 2000,
  "The Phantom of the Opera": 41445,
};

async function fetchGutenberg(book) {
  const gid = gutenbergMap[book.title];
  if (!gid) {
    console.log(`⏭️ ${book.title} → No Gutenberg ID`);
    return;
  }
  
  return new Promise((resolve) => {
    const url = `https://www.gutenberg.org/cache/epub/${gid}/pg${gid}.txt`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (data.length > 500) {
          const clean = data.substring(0, 50000);
          db.prepare('UPDATE books SET text_content = ? WHERE title = ?').run(clean, book.title);
          console.log(`✅ ${book.title} → ${clean.length} chars`);
        } else {
          console.log(`❌ ${book.title} → Empty`);
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
  const books = db.prepare('SELECT title FROM books WHERE text_content IS NULL').all();
  
  for (const book of books) {
    await fetchGutenberg(book);
    await new Promise(r => setTimeout(r, 300));
  }
  
  const total = db.prepare('SELECT COUNT(*) as c FROM books WHERE text_content IS NOT NULL').get().c;
  console.log(`\n📖 Books with readable text: ${total}`);
  process.exit(0);
}

main();