const Database = require('better-sqlite3');
const path = require('path');
const dbPath = process.env.DATABASE_PATH || 'booktok.db';
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT,
    google_id TEXT UNIQUE,
    birth_year INTEGER NOT NULL,
    bio TEXT DEFAULT '',
    profile_pic TEXT DEFAULT NULL,
    favourite_genres TEXT DEFAULT '[]',
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS friend_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_id INTEGER NOT NULL,
    to_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY (from_id) REFERENCES users(id),
    FOREIGN KEY (to_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS friendships (
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, friend_id)
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    media TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS likes (
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, post_id)
  );

  CREATE TABLE IF NOT EXISTS chat_rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    creator_id INTEGER NOT NULL,
    members TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    parent_id INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES comments(id)
  );

  CREATE TABLE IF NOT EXISTS reading_list (
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    status TEXT DEFAULT 'want_to_read',
    progress INTEGER DEFAULT 0,
    total_pages INTEGER DEFAULT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, book_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    from_user_id INTEGER,
    post_id INTEGER,
    comment_id INTEGER,
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (comment_id) REFERENCES comments(id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    rating INTEGER CHECK(rating >= 1 AND rating <= 5),
    review_text TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id),
    UNIQUE(user_id, book_id)
  );

  CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    badge_name TEXT NOT NULL,
    badge_icon TEXT DEFAULT '🏆',
    requirement_type TEXT NOT NULL,
    requirement_value INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS user_challenges (
    user_id INTEGER NOT NULL,
    challenge_id INTEGER NOT NULL,
    progress INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    completed_at DATETIME,
    PRIMARY KEY (user_id, challenge_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (challenge_id) REFERENCES challenges(id)
  );

  CREATE TABLE IF NOT EXISTS user_badges (
    user_id INTEGER NOT NULL,
    badge_name TEXT NOT NULL,
    badge_icon TEXT DEFAULT '🏆',
    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, badge_name)
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER NOT NULL,
    reported_user_id INTEGER NOT NULL,
    post_id INTEGER,
    reason TEXT DEFAULT '',
    resolved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_id) REFERENCES users(id),
    FOREIGN KEY (reported_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS blocks (
    blocker_id INTEGER NOT NULL,
    blocked_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (blocker_id, blocked_id)
  );

  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    genre TEXT NOT NULL,
    min_age INTEGER DEFAULT 0,
    max_age INTEGER DEFAULT 18,
    cover_url TEXT DEFAULT NULL
  );
`);

// Seed books
const count = db.prepare('SELECT COUNT(*) AS cnt FROM books').get();
if (count.cnt === 0) {
  const insert = db.prepare('INSERT INTO books (title, author, genre, min_age, max_age, cover_url) VALUES (?, ?, ?, ?, ?, ?)');
  const books = [
  ["Harry Potter and the Sorcerer's Stone", 'J.K. Rowling', 'Fantasy', 8, 14, 'https://covers.openlibrary.org/b/olid/OL82586W-M.jpg'],
  ['The Hobbit', 'J.R.R. Tolkien', 'Fantasy', 8, 14, 'https://covers.openlibrary.org/b/olid/OL14933414W-M.jpg'],
  ['Percy Jackson: The Lightning Thief', 'Rick Riordan', 'Fantasy', 9, 14, 'https://covers.openlibrary.org/b/olid/OL572002W-M.jpg'],
  ['The Chronicles of Narnia', 'C.S. Lewis', 'Fantasy', 7, 13, 'https://covers.openlibrary.org/b/olid/OL76524W-M.jpg'],
  ['1984', 'George Orwell', 'Dystopian', 14, 18, 'https://covers.openlibrary.org/b/olid/OL1168082W-M.jpg'],
  ['The Hunger Games', 'Suzanne Collins', 'Dystopian', 12, 18, 'https://covers.openlibrary.org/b/olid/OL573536W-M.jpg'],
  ['Divergent', 'Veronica Roth', 'Dystopian', 13, 18, 'https://covers.openlibrary.org/b/olid/OL17073114W-M.jpg'],
  ['The Fault in Our Stars', 'John Green', 'Romance', 13, 18, 'https://covers.openlibrary.org/b/olid/OL19986424W-M.jpg'],
  ['To All the Boys I’ve Loved Before', 'Jenny Han', 'Romance', 12, 17, 'https://covers.openlibrary.org/b/olid/OL17083148W-M.jpg'],
  ['The Very Hungry Caterpillar', 'Eric Carle', 'Children', 2, 5, 'https://covers.openlibrary.org/b/olid/OL3309037W-M.jpg'],
  ["Charlotte's Web", 'E.B. White', 'Children', 6, 10, 'https://covers.openlibrary.org/b/olid/OL483391W-M.jpg'],
  ['Goodnight Moon', 'Margaret Wise Brown', 'Children', 1, 4, 'https://covers.openlibrary.org/b/olid/OL39190W-M.jpg'],
  ['Diary of a Wimpy Kid', 'Jeff Kinney', 'Comedy', 8, 13, 'https://covers.openlibrary.org/b/olid/OL13620584W-M.jpg'],
  ['The Hitchhiker’s Guide to the Galaxy', 'Douglas Adams', 'Comedy', 12, 18, 'https://covers.openlibrary.org/b/olid/OL17925474W-M.jpg'],
  ['Bossypants', 'Tina Fey', 'Comedy', 14, 18, 'https://covers.openlibrary.org/b/olid/OL15932898W-M.jpg'],
  ['The Westing Game', 'Ellen Raskin', 'Mystery', 9, 14, 'https://covers.openlibrary.org/b/olid/OL1863961W-M.jpg'],
  ['Nancy Drew: The Secret of the Old Clock', 'Carolyn Keene', 'Mystery', 8, 13, 'https://covers.openlibrary.org/b/olid/OL2790598W-M.jpg'],
  ['The Girl with the Dragon Tattoo', 'Stieg Larsson', 'Mystery', 16, 18, 'https://covers.openlibrary.org/b/olid/OL585562W-M.jpg'],
  ['Ender’s Game', 'Orson Scott Card', 'Sci‑Fi', 12, 18, 'https://covers.openlibrary.org/b/olid/OL49777W-M.jpg'],
  ['A Wrinkle in Time', 'Madeleine L’Engle', 'Sci‑Fi', 9, 14, 'https://covers.openlibrary.org/b/olid/OL49957W-M.jpg'],
  ['The Martian', 'Andy Weir', 'Sci‑Fi', 13, 18, 'https://covers.openlibrary.org/b/olid/OL19999193W-M.jpg'],
  ['Coraline', 'Neil Gaiman', 'Horror', 9, 14, 'https://covers.openlibrary.org/b/olid/OL679359W-M.jpg'],
  ['Miss Peregrine’s Home for Peculiar Children', 'Ransom Riggs', 'Horror', 12, 17, 'https://covers.openlibrary.org/b/olid/OL16473944W-M.jpg'],
  ['Number the Stars', 'Lois Lowry', 'Historical Fiction', 9, 13, 'https://covers.openlibrary.org/b/olid/OL3930557W-M.jpg'],
  ['The Book Thief', 'Markus Zusak', 'Historical Fiction', 13, 18, 'https://covers.openlibrary.org/b/olid/OL10666953W-M.jpg'],
  ['The Diary of a Young Girl', 'Anne Frank', 'Non‑Fiction', 12, 18, 'https://covers.openlibrary.org/b/olid/OL1092472W-M.jpg'],
  ['Steve Jobs', 'Walter Isaacson', 'Non‑Fiction', 14, 18, 'https://covers.openlibrary.org/b/olid/OL16113825W-M.jpg'],
  ['National Geographic Kids Almanac', 'National Geographic', 'Non‑Fiction', 7, 12, null],   // no cover – will show fallback icon
  ['Hatchet', 'Gary Paulsen', 'Adventure', 10, 14, 'https://covers.openlibrary.org/b/olid/OL50519W-M.jpg'],
  ['Treasure Island', 'Robert Louis Stevenson', 'Adventure', 9, 14, 'https://covers.openlibrary.org/b/olid/OL24165W-M.jpg'],
  ['Life of Pi', 'Yann Martel', 'Adventure', 13, 18, 'https://covers.openlibrary.org/b/olid/OL100796W-M.jpg']
];  
  for (const b of books) insert.run(...b);
}

// Seed challenges
if (db.prepare('SELECT COUNT(*) AS cnt FROM challenges').get().cnt === 0) {
  const ins = db.prepare('INSERT INTO challenges (name, description, badge_name, badge_icon, requirement_type, requirement_value, start_date, end_date) VALUES (?,?,?,?,?,?,?,?)');
  
  // ── 📚 Reading Challenges ──
  ins.run('Bookworm Beginner', 'Finish reading 5 books', 'Bookworm Beginner', '📖', 'finished', 5, '2025-01-01', '2025-12-31');
  ins.run('Page Turner', 'Finish reading 10 books', 'Page Turner', '📚', 'finished', 10, '2025-01-01', '2025-12-31');
  ins.run('Library Legend', 'Finish reading 25 books', 'Library Legend', '🏛️', 'finished', 25, '2025-01-01', '2025-12-31');
  ins.run('Speed Reader', 'Finish reading 3 books in a single month', 'Speed Reader', '⚡', 'finished_fast', 3, '2025-01-01', '2025-12-31');
  
  ins.run('Fantasy Explorer', 'Finish reading 2 Fantasy books', 'Fantasy Explorer', '🐉', 'genre_read', 2, '2025-01-01', '2025-12-31');
  ins.run('Sci‑Fi Voyager', 'Finish reading 3 Sci‑Fi books', 'Sci‑Fi Voyager', '🚀', 'genre_read', 3, '2025-01-01', '2025-12-31');
  ins.run('Mystery Detective', 'Finish reading 2 Mystery books', 'Mystery Detective', '🔍', 'genre_read', 2, '2025-01-01', '2025-12-31');
  ins.run('Romantic Reader', 'Finish reading 2 Romance books', 'Romantic Reader', '💕', 'genre_read', 2, '2025-01-01', '2025-12-31');
  ins.run('Horror Fan', 'Finish reading 2 Horror books', 'Horror Fan', '👻', 'genre_read', 2, '2025-01-01', '2025-12-31');
  ins.run('Dystopian Survivor', 'Finish reading 2 Dystopian books', 'Dystopian Survivor', '🌆', 'genre_read', 2, '2025-01-01', '2025-12-31');
  ins.run('Adventure Seeker', 'Finish reading 2 Adventure books', 'Adventure Seeker', '🗺️', 'genre_read', 2, '2025-01-01', '2025-12-31');

  ins.run('Genre Master', 'Read a book from 5 different genres', 'Genre Master', '🌈', 'unique_genres', 5, '2025-01-01', '2025-12-31');
  ins.run('Century Club', 'Read a total of 100 pages', 'Century Club', '💯', 'total_pages', 100, '2025-01-01', '2025-12-31');
  ins.run('Thick Book Tamer', 'Finish a book with 500+ pages', 'Thick Book Tamer', '📕', 'thick_book', 1, '2025-01-01', '2025-12-31');

  // ── ✍️ Reviewing & Rating ──
  ins.run('Review Rookie', 'Write 3 book reviews', 'Review Rookie', '📝', 'review', 3, '2025-01-01', '2025-12-31');
  ins.run('Review Pro', 'Write 10 book reviews', 'Review Pro', '✍️', 'review', 10, '2025-01-01', '2025-12-31');
  ins.run('Star Collector', 'Rate 5 books', 'Star Collector', '⭐', 'rating', 5, '2025-01-01', '2025-12-31');
  ins.run('Star Critic', 'Rate 20 books', 'Star Critic', '🌟', 'rating', 20, '2025-01-01', '2025-12-31');
  ins.run('Word Wizard', 'Write a review with over 100 characters', 'Word Wizard', '🧙', 'detailed_review', 1, '2025-01-01', '2025-12-31');
  ins.run('Honest Reviewer', 'Give a 1‑star or 5‑star rating', 'Honest Reviewer', '🫣', 'extreme_rating', 1, '2025-01-01', '2025-12-31');

  // ── 📝 Posting & Content ──
  ins.run('First Post', 'Create your first post', 'First Post', '🎉', 'post', 1, '2025-01-01', '2025-12-31');
  ins.run('Frequent Poster', 'Create 10 posts', 'Frequent Poster', '📬', 'post', 10, '2025-01-01', '2025-12-31');
  ins.run('Media Mogul', 'Upload a photo or video in a post', 'Media Mogul', '📸', 'media_post', 1, '2025-01-01', '2025-12-31');
  ins.run('Tag Master', 'Use 5 different tags across your posts', 'Tag Master', '🏷️', 'unique_tags', 5, '2025-01-01', '2025-12-31');

  // ── 💬 Social & Community ──
  ins.run('Friendly Face', 'Become friends with 3 people', 'Friendly Face', '👥', 'friend', 3, '2025-01-01', '2025-12-31');
  ins.run('Social Butterfly', 'Become friends with 10 people', 'Social Butterfly', '🦋', 'friend', 10, '2025-01-01', '2025-12-31');
  ins.run('Conversation Starter', 'Comment on 5 posts', 'Conversation Starter', '💬', 'comment', 5, '2025-01-01', '2025-12-31');
  ins.run('Chatterbox', 'Comment on 20 posts', 'Chatterbox', '🗣️', 'comment', 20, '2025-01-01', '2025-12-31');
  ins.run('Reply Guy', 'Send 5 replies to comments', 'Reply Guy', '🔁', 'reply', 5, '2025-01-01', '2025-12-31');
  ins.run('Popular Post', 'Receive 10 likes on a single post', 'Popular Post', '🔥', 'likes_on_post', 10, '2025-01-01', '2025-12-31');
  ins.run('Like Magnet', 'Receive a total of 50 likes', 'Like Magnet', '🧲', 'like_received', 50, '2025-01-01', '2025-12-31');

  // ── 🏆 Special / Hidden ──
  ins.run('Challenge Champion', 'Complete 10 different challenges', 'Challenge Champion', '🏆', 'challenge_completed', 10, '2025-01-01', '2025-12-31');
  ins.run('Night Owl', 'Post or comment between midnight and 4am', 'Night Owl', '🦉', 'night_activity', 1, '2025-01-01', '2025-12-31');
}
module.exports = db;