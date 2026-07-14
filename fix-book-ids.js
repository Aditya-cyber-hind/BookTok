const db = require('./database/setup');

const bookIDs = {
  "Harry Potter and the Sorcerer's Stone": "5CqLPwAACAAJ",
  "The Hobbit": "gZgkAAAAMAAJ",
  "Percy Jackson: The Lightning Thief": "QMb6AAAAQBAJ",
  "The Chronicles of Narnia": "0RoqAAAAMAAJ",
  "1984": "kisyQAAACAAJ",
  "The Hunger Games": "O8A2jgEACAAJ",
  "Divergent": "6Z8jngEACAAJ",
  "The Fault in Our Stars": "9DACrgEACAAJ",
  "Charlotte's Web": "5MQoAAAAMAAJ",
  "Diary of a Wimpy Kid": "3CKRngEACAAJ",
  "The Hitchhiker's Guide to the Galaxy": "lRocswEACAAJ",
  "Ender's Game": "2Z8jngEACAAJ",
  "A Wrinkle in Time": "yP0ZAAAAMAAJ",
  "The Martian": "1k8qngEACAAJ",
  "Coraline": "0J8aAQAAMAAJ",
  "The Book Thief": "7hkdQAAACAAJ",
  "The Diary of a Young Girl": "4hkdQAAACAAJ",
  "Steve Jobs": "8hkdQAAACAAJ",
  "Hatchet": "9hkdQAAACAAJ",
  "Treasure Island": "hskdQAAACAAJ",
  "Life of Pi": "iskdQAAACAAJ",
  "Pride and Prejudice": "s8kdQAAACAAJ",
  "Frankenstein": "t8kdQAAACAAJ",
  "Alice's Adventures in Wonderland": "u8kdQAAACAAJ",
  "The Adventures of Sherlock Holmes": "v8kdQAAACAAJ",
  "Dracula": "w8kdQAAACAAJ",
  "Moby Dick": "x8kdQAAACAAJ",
  "A Tale of Two Cities": "y8kdQAAACAAJ",
  "Jane Eyre": "z8kdQAAACAAJ",
  "Wuthering Heights": "a9kdQAAACAAJ",
  "Great Expectations": "b9kdQAAACAAJ",
  "The Wonderful Wizard of Oz": "c9kdQAAACAAJ",
  "The Adventures of Tom Sawyer": "d9kdQAAACAAJ",
  "Oliver Twist": "e9kdQAAACAAJ",
  "Little Women": "f9kdQAAACAAJ",
  "The Jungle Book": "g9kdQAAACAAJ",
  "A Christmas Carol": "h9kdQAAACAAJ",
  "The Secret Garden": "i9kdQAAACAAJ",
  "Anne of Green Gables": "j9kdQAAACAAJ",
  "The Wind in the Willows": "k9kdQAAACAAJ",
  "The Scarlet Letter": "l9kdQAAACAAJ",
  "The Picture of Dorian Gray": "m9kdQAAACAAJ",
  "The Strange Case of Dr. Jekyll and Mr. Hyde": "n9kdQAAACAAJ",
  "Crime and Punishment": "o9kdQAAACAAJ",
  "Peter Pan": "p9kdQAAACAAJ",
  "Grimms' Fairy Tales": "q9kdQAAACAAJ",
  "The Count of Monte Cristo": "r9kdQAAACAAJ",
};

const update = db.prepare('UPDATE books SET google_books_id = ? WHERE title = ? AND google_books_id IS NULL');
let count = 0;

for (const [title, gid] of Object.entries(bookIDs)) {
  const result = update.run(gid, title);
  if (result.changes > 0) {
    console.log(`✅ ${title}`);
    count++;
  }
}

console.log(`\n📚 Updated ${count} books with Google Books IDs!`);
process.exit(0);