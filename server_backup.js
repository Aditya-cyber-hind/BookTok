const express = require('express');
const session = require('express-session');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database/setup');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const saltRounds = 10;

// Uploads folder
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /\.(jpe?g|png|gif|webp|mp4|webm|ogg)$/i;
    const allowedMimes = /^image\/(jpeg|png|gif|webp)|video\/(mp4|webm|ogg)$/i;
    const extValid = allowedExtensions.test(path.extname(file.originalname));
    const mimeValid = allowedMimes.test(file.mimetype);
    if (extValid && mimeValid) return cb(null, true);
    cb(new Error('Only images/videos allowed'));
  }
});

// Safe column migrations
try { db.exec('ALTER TABLE users ADD COLUMN profile_pic TEXT DEFAULT NULL'); } catch(e){}
try { db.exec('ALTER TABLE posts ADD COLUMN media TEXT DEFAULT NULL'); } catch(e){}
try { db.exec('ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE'); } catch(e){}
try { db.exec('ALTER TABLE books ADD COLUMN cover_url TEXT DEFAULT NULL'); } catch(e){}
try { db.exec("ALTER TABLE posts ADD COLUMN type TEXT DEFAULT 'post'"); } catch(e){}
try { db.exec('ALTER TABLE posts ADD COLUMN quote_text TEXT DEFAULT NULL'); } catch(e){}
try { db.exec('ALTER TABLE posts ADD COLUMN quote_author TEXT DEFAULT NULL'); } catch(e){}
try { db.exec('ALTER TABLE posts ADD COLUMN quote_book_title TEXT DEFAULT NULL'); } catch(e){}
try { db.exec('ALTER TABLE users ADD COLUMN private_profile INTEGER DEFAULT 0'); } catch(e){}
try { db.exec('ALTER TABLE users ADD COLUMN avatar_config TEXT DEFAULT NULL'); } catch(e){}

// Create reading_sessions and reactions tables if not exist
db.exec(`
  CREATE TABLE IF NOT EXISTS reading_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    duration_seconds INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS reactions (
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    emoji TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (post_id) REFERENCES posts(id)
  );
  CREATE TABLE IF NOT EXISTS ai_chat_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,          -- 'user' or 'assistant'
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`);

// Session
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'booktok-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
});
app.use(sessionMiddleware);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static('uploads'));

// Passport Google
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.id);
      if (!user) {
        const stmt = db.prepare('INSERT INTO users (username, google_id, birth_year, favourite_genres) VALUES (?, ?, ?, ?)');
        const info = stmt.run(profile.displayName, profile.id, 2000, '[]');
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
      }
      return done(null, user);
    } catch(e) { return done(e); }
  }
));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  done(null, user);
});
app.use(passport.initialize());
app.use(passport.session());
app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => res.redirect('/'));
app.get('/logout', (req, res, next) => { req.logout(err => { if(err) return next(err); res.redirect('/'); }); });

// ─── AUTH ───────────────────────────────────────────────
app.post('/api/signup', (req, res) => {
  const { username, password, birth_year, favourite_genres } = req.body;
  if (!username || !password || !birth_year) return res.status(400).json({ error: 'Missing fields' });
  try {
    const hash = bcrypt.hashSync(password, saltRounds);
    const stmt = db.prepare('INSERT INTO users (username, password, birth_year, favourite_genres) VALUES (?, ?, ?, ?)');
    const info = stmt.run(username, hash, birth_year, JSON.stringify(favourite_genres || []));
    req.session.userId = info.lastInsertRowid;
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already taken' });
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
  req.session.userId = user.id;
  res.json({ success: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const user = db.prepare('SELECT id, username, birth_year, bio, favourite_genres, profile_pic FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  user.favourite_genres = JSON.parse(user.favourite_genres);
  res.json(user);
});

// ─── FRIEND SYSTEM ──────────────────────────────────────
app.post('/api/friend-request', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { toUsername } = req.body;
  const toUser = db.prepare('SELECT id FROM users WHERE username = ?').get(toUsername);
  if (!toUser) return res.status(404).json({ error: 'User not found' });
  if (toUser.id === userId) return res.status(400).json({ error: 'Cannot friend yourself' });
  const already = db.prepare('SELECT * FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)')
    .get(userId, toUser.id, toUser.id, userId);
  if (already) return res.status(400).json({ error: 'Already friends' });
  const existing = db.prepare('SELECT * FROM friend_requests WHERE from_id = ? AND to_id = ? AND status = ?')
    .get(userId, toUser.id, 'pending');
  if (existing) return res.status(400).json({ error: 'Request already sent' });
  db.prepare('INSERT INTO friend_requests (from_id, to_id) VALUES (?, ?)').run(userId, toUser.id);
  createNotification(toUser.id, 'friend_request', userId);
  res.json({ success: true });
});

app.get('/api/friend-requests', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const requests = db.prepare('SELECT fr.id, fr.from_id, u.username, fr.status FROM friend_requests fr JOIN users u ON fr.from_id = u.id WHERE fr.to_id = ? AND fr.status = ?')
    .all(userId, 'pending');
  res.json(requests);
});

app.post('/api/friend-respond', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { requestId, accept } = req.body;
  const request = db.prepare('SELECT * FROM friend_requests WHERE id = ? AND to_id = ?').get(requestId, userId);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (accept) {
    const insert = db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)');
    insert.run(request.from_id, request.to_id);
    insert.run(request.to_id, request.from_id);
    db.prepare('UPDATE friend_requests SET status = ? WHERE id = ?').run('accepted', requestId);
    updateChallengeProgress(userId, 'friend');
    updateChallengeProgress(request.from_id, 'friend');
  } else {
    db.prepare('UPDATE friend_requests SET status = ? WHERE id = ?').run('rejected', requestId);
  }
  res.json({ success: true });
});

app.get('/api/friends', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const friends = db.prepare('SELECT u.id, u.username FROM friendships f JOIN users u ON f.friend_id = u.id WHERE f.user_id = ?').all(userId);
  res.json(friends);
});

// ─── POSTS / FEED (with block filtering & quote support) ──
app.post('/api/posts', upload.single('media'), (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { content, tags, type } = req.body;
  const postType = (type === 'quote') ? 'quote' : 'post';
  let tagsArray = [];
  if (typeof tags === 'string' && tags.trim().length > 0) tagsArray = tags.split(',').map(t => t.trim()).filter(t => t);

  // Content warning filter (server-side)
  const bannedWords = ['badword1', 'badword2']; // extend as needed
  const checkText = content?.toLowerCase() || '';
  if (bannedWords.some(w => checkText.includes(w))) {
    return res.status(400).json({ error: 'Post contains inappropriate language.' });
  }

  if (postType === 'quote') {
    const { quote_text, quote_author, quote_book_title } = req.body;
    if (!quote_text) return res.status(400).json({ error: 'Quote text required' });
    db.prepare('INSERT INTO posts (author_id, content, tags, type, quote_text, quote_author, quote_book_title) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(userId, content || '', JSON.stringify(tagsArray), 'quote', quote_text, quote_author || null, quote_book_title || null);
  } else {
    if (!content) return res.status(400).json({ error: 'Post content required' });
    const mediaFilename = req.file ? req.file.filename : null;
    db.prepare('INSERT INTO posts (author_id, content, tags, media, type) VALUES (?, ?, ?, ?, ?)')
      .run(userId, content, JSON.stringify(tagsArray), mediaFilename, 'post');
  }

  updateChallengeProgress(userId, 'post');
  if (req.file) updateChallengeProgress(userId, 'media_post');
  if (tagsArray.length > 0) {
    const existingTags = db.prepare('SELECT tags FROM posts WHERE author_id = ?').all(userId);
    const allTags = new Set();
    existingTags.forEach(p => {
      try { JSON.parse(p.tags).forEach(t => allTags.add(t)); } catch(e) {}
    });
    tagsArray.forEach(t => allTags.add(t));
    if (allTags.size >= 5) updateChallengeProgress(userId, 'unique_tags');
  }
  res.json({ success: true });
});

app.put('/api/posts/:id', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const postId = parseInt(req.params.id);
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.author_id !== userId) return res.status(403).json({ error: 'Not your post' });
  const { content, tags } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  let tagsArray = [];
  if (typeof tags === 'string' && tags.trim().length > 0) tagsArray = tags.split(',').map(t => t.trim()).filter(t => t);
  db.prepare('UPDATE posts SET content = ?, tags = ? WHERE id = ?').run(content, JSON.stringify(tagsArray), postId);
  res.json({ success: true });
});

app.delete('/api/posts/:id', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const postId = parseInt(req.params.id);
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.author_id !== userId) return res.status(403).json({ error: 'Not your post' });
  db.prepare('DELETE FROM comments WHERE post_id = ?').run(postId);
  db.prepare('DELETE FROM likes WHERE post_id = ?').run(postId);
  db.prepare('DELETE FROM reactions WHERE post_id = ?').run(postId);
  db.prepare('DELETE FROM posts WHERE id = ?').run(postId);
  res.json({ success: true });
});

// Emoji reactions
app.get('/api/posts/:postId/reactions', (req, res) => {
  const postId = parseInt(req.params.postId);
  const reactions = db.prepare('SELECT emoji, COUNT(*) as count FROM reactions WHERE post_id = ? GROUP BY emoji').all(postId);
  const userId = getCurrentUserId(req);
  let userReaction = null;
  if (userId) {
    const ur = db.prepare('SELECT emoji FROM reactions WHERE user_id = ? AND post_id = ?').get(userId, postId);
    if (ur) userReaction = ur.emoji;
  }
  res.json({ reactions, userReaction });
});

app.post('/api/posts/:postId/react', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const postId = parseInt(req.params.postId);
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'emoji required' });

  const existing = db.prepare('SELECT * FROM reactions WHERE user_id = ? AND post_id = ?').get(userId, postId);
  if (existing) {
    if (existing.emoji === emoji) {
      db.prepare('DELETE FROM reactions WHERE user_id = ? AND post_id = ?').run(userId, postId);
    } else {
      db.prepare('UPDATE reactions SET emoji = ? WHERE user_id = ? AND post_id = ?').run(emoji, userId, postId);
    }
  } else {
    db.prepare('INSERT INTO reactions (user_id, post_id, emoji) VALUES (?, ?, ?)').run(userId, postId, emoji);
  }
  res.json({ success: true });
});

app.post('/api/like', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { postId } = req.body;
  const existing = db.prepare('SELECT * FROM likes WHERE user_id = ? AND post_id = ?').get(userId, postId);
  if (existing) {
    db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?').run(userId, postId);
  } else {
    db.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)').run(userId, postId);
    const post = db.prepare('SELECT author_id FROM posts WHERE id = ?').get(postId);
    if (post) {
      createNotification(post.author_id, 'like', userId, postId);
      updateChallengeProgress(post.author_id, 'like_received');
      const likeCount = db.prepare('SELECT COUNT(*) AS cnt FROM likes WHERE post_id = ?').get(postId)?.cnt || 0;
      if (likeCount >= 10) updateChallengeProgress(post.author_id, 'likes_on_post');
    }
  }
  res.json({ success: true });
});

function getBlockedUserIds(userId) {
  const blocked = db.prepare('SELECT blocked_id FROM blocks WHERE blocker_id = ?').all(userId);
  return blocked.map(b => b.blocked_id);
}

app.get('/api/feed', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const friends = db.prepare('SELECT friend_id FROM friendships WHERE user_id = ?').all(userId).map(f => f.friend_id);
  const allIds = [userId, ...friends];
  const blocked = getBlockedUserIds(userId);
  const placeholders = allIds.map(() => '?').join(',');
  let query = `SELECT p.id, p.author_id, p.content, p.tags, p.media, p.type, p.quote_text, p.quote_author, p.quote_book_title, p.created_at, u.username,
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
    EXISTS (SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) AS liked
    FROM posts p JOIN users u ON p.author_id = u.id
    WHERE p.author_id IN (${placeholders})`;
  const params = [userId, ...allIds];
  if (blocked.length > 0) {
    query += ` AND p.author_id NOT IN (${blocked.map(() => '?').join(',')})`;
    params.push(...blocked);
  }
  query += ' ORDER BY p.created_at DESC LIMIT 50';
  let posts = db.prepare(query).all(...params);
  posts.forEach(p => {
    try { p.tags = JSON.parse(p.tags); } catch(e) { p.tags = []; }
    p.media_url = p.media ? `/uploads/${p.media}` : null;
  });
  res.json(posts);
});

app.get('/api/feed/global', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const blocked = getBlockedUserIds(userId);
  let query = `SELECT p.id, p.author_id, p.content, p.tags, p.media, p.type, p.quote_text, p.quote_author, p.quote_book_title, p.created_at, u.username,
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
    EXISTS (SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) AS liked
    FROM posts p JOIN users u ON p.author_id = u.id`;
  const params = [userId];
  if (blocked.length > 0) {
    query += ` WHERE p.author_id NOT IN (${blocked.map(() => '?').join(',')})`;
    params.push(...blocked);
  }
  query += ' ORDER BY p.created_at DESC LIMIT 50';
  let posts = db.prepare(query).all(...params);
  posts.forEach(p => {
    try { p.tags = JSON.parse(p.tags); } catch(e) { p.tags = []; }
    p.media_url = p.media ? `/uploads/${p.media}` : null;
  });
  res.json(posts);
});

app.get('/api/feed/for-you', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const likedPosts = db.prepare('SELECT p.tags FROM likes l JOIN posts p ON l.post_id = p.id WHERE l.user_id = ? ORDER BY p.created_at DESC LIMIT 50').all(userId);
  const userTagScores = new Map();
  likedPosts.forEach(p => {
    let tags = [];
    try { tags = JSON.parse(p.tags); } catch(e) {
      if (typeof p.tags === 'string' && p.tags.trim().length > 0) tags = p.tags.split(',').map(t => t.trim());
    }
    (tags||[]).forEach(tag => userTagScores.set(tag, (userTagScores.get(tag)||0)+1));
  });
  if (userTagScores.size === 0) return res.json([]);
  const blocked = getBlockedUserIds(userId);
  let query = `SELECT p.id, p.author_id, p.content, p.tags, p.media, p.type, p.quote_text, p.quote_author, p.quote_book_title, p.created_at, u.username,
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count
    FROM posts p JOIN users u ON p.author_id = u.id
    WHERE NOT EXISTS (SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?)`;
  const params = [userId];
  if (blocked.length > 0) {
    query += ` AND p.author_id NOT IN (${blocked.map(() => '?').join(',')})`;
    params.push(...blocked);
  }
  query += ' ORDER BY p.created_at DESC LIMIT 200';
  let allPosts = db.prepare(query).all(...params);
  const scored = allPosts.map(post => {
    let tags = [];
    try { tags = JSON.parse(post.tags); } catch(e) {}
    let score = 0;
    (tags||[]).forEach(tag => { if (userTagScores.has(tag)) score += userTagScores.get(tag); });
    score += Math.log(post.like_count + 1);
    return { ...post, score, tags };
  });
  scored.sort((a,b) => b.score - a.score);
  const result = scored.slice(0,30);
  result.forEach(p => {
    p.media_url = p.media ? `/uploads/${p.media}` : null;
    p.liked = false;
  });
  res.json(result);
});

// ─── SEARCH ──────────────────────────────────────────────
app.get('/api/search', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const q = req.query.q?.trim();
  if (!q) return res.json({ users: [], posts: [], books: [] });
  const like = `%${q}%`;
  const users = db.prepare('SELECT id, username, profile_pic FROM users WHERE username LIKE ? LIMIT 10').all(like);
  users.forEach(u => u.profile_pic_url = u.profile_pic ? `/uploads/${u.profile_pic}` : null);
  const posts = db.prepare(`
    SELECT p.id, p.author_id, p.content, p.tags, p.media, p.created_at, u.username,
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count
    FROM posts p JOIN users u ON p.author_id = u.id
    WHERE p.content LIKE ? OR p.tags LIKE ?
    ORDER BY p.created_at DESC LIMIT 10
  `).all(like, like);
  posts.forEach(p => {
    try { p.tags = JSON.parse(p.tags); } catch(e) { p.tags = []; }
    p.media_url = p.media ? `/uploads/${p.media}` : null;
  });
  const books = db.prepare('SELECT id, title, author, cover_url FROM books WHERE title LIKE ? OR author LIKE ? OR genre LIKE ? LIMIT 10').all(like, like, like);
  res.json({ users, posts, books });
});

// ─── READING STATUS & LIST ──────────────────────────────
app.post('/api/books/:id/reading-status', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const bookId = parseInt(req.params.id);
  const { status, progress, total_pages } = req.body;
  const validStatuses = ['want_to_read', 'currently_reading', 'finished'];
  if (!status || !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const existing = db.prepare('SELECT * FROM reading_list WHERE user_id = ? AND book_id = ?').get(userId, bookId);
  if (existing) {
    db.prepare('UPDATE reading_list SET status=?, progress=?, total_pages=? WHERE user_id=? AND book_id=?')
      .run(status, progress||0, total_pages||null, userId, bookId);
  } else {
    db.prepare('INSERT INTO reading_list (user_id, book_id, status, progress, total_pages) VALUES (?,?,?,?,?)')
      .run(userId, bookId, status, progress||0, total_pages||null);
  }
  if (status === 'finished') {
    updateChallengeProgress(userId, 'finished');
    const book = db.prepare('SELECT genre FROM books WHERE id = ?').get(bookId);
    if (book) updateChallengeProgress(userId, 'genre_read', book.genre);
  }
  if (status === 'want_to_read') updateChallengeProgress(userId, 'want_to_read');
  res.json({ success: true });
});

app.get('/api/reading-list', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const books = db.prepare(`
    SELECT b.*, r.status, r.progress, r.total_pages
    FROM books b JOIN reading_list r ON b.id = r.book_id
    WHERE r.user_id = ? ORDER BY r.added_at DESC
  `).all(userId);
  res.json(books);
});

// ─── BLOCK / REPORT ─────────────────────────────────────
app.post('/api/block/:userId', (req, res) => {
  const blockerId = getCurrentUserId(req);
  if (!blockerId) return res.status(401).json({ error: 'Not logged in' });
  const blockedId = parseInt(req.params.userId);
  if (blockerId === blockedId) return res.status(400).json({ error: 'Cannot block yourself' });
  const existing = db.prepare('SELECT * FROM blocks WHERE blocker_id = ? AND blocked_id = ?').get(blockerId, blockedId);
  if (existing) {
    db.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?').run(blockerId, blockedId);
    res.json({ success: true, blocked: false });
  } else {
    db.prepare('INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)').run(blockerId, blockedId);
    res.json({ success: true, blocked: true });
  }
});

app.post('/api/report', (req, res) => {
  const reporterId = getCurrentUserId(req);
  if (!reporterId) return res.status(401).json({ error: 'Not logged in' });
  const { reported_user_id, post_id, reason } = req.body;
  if (!reported_user_id) return res.status(400).json({ error: 'Missing reported user' });
  db.prepare('INSERT INTO reports (reporter_id, reported_user_id, post_id, reason) VALUES (?, ?, ?, ?)')
    .run(reporterId, reported_user_id, post_id || null, reason || '');
  res.json({ success: true });
});

// ─── COMMENTS ───────────────────────────────────────────
app.get('/api/posts/:postId/comments', (req, res) => {
  const postId = parseInt(req.params.postId);
  const comments = db.prepare(`
    SELECT c.id, c.content, c.created_at, c.parent_id, u.username, u.profile_pic
    FROM comments c JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ? ORDER BY c.created_at ASC
  `).all(postId);
  comments.forEach(c => c.profile_pic_url = c.profile_pic ? `/uploads/${c.profile_pic}` : null);
  res.json(comments);
});

app.post('/api/posts/:postId/comments', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const postId = parseInt(req.params.postId);
  const { content, parentId } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content required' });
  const post = db.prepare('SELECT id, author_id FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (parentId) {
    const parent = db.prepare('SELECT id, post_id FROM comments WHERE id = ?').get(parentId);
    if (!parent || parent.post_id !== postId) return res.status(400).json({ error: 'Invalid parent' });
  }
  const stmt = db.prepare('INSERT INTO comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)');
  const info = stmt.run(postId, userId, content.trim(), parentId || null);
  if (post.author_id !== userId) createNotification(post.author_id, 'comment', userId, postId, info.lastInsertRowid);
  if (parentId) {
    const parentComment = db.prepare('SELECT user_id FROM comments WHERE id = ?').get(parentId);
    if (parentComment && parentComment.user_id !== userId) createNotification(parentComment.user_id, 'reply', userId, postId, info.lastInsertRowid);
    updateChallengeProgress(userId, 'reply');
  }
  updateChallengeProgress(userId, 'comment');
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 4) updateChallengeProgress(userId, 'night_activity');
  res.json({ success: true, commentId: info.lastInsertRowid });
});

// ─── RECOMMENDATIONS ────────────────────────────────────
app.get('/api/recommendations', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const user = db.prepare('SELECT birth_year, favourite_genres FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  const age = new Date().getFullYear() - user.birth_year;
  const genres = JSON.parse(user.favourite_genres || '[]');
  let books;
  if (genres.length === 0) {
    books = db.prepare('SELECT * FROM books WHERE min_age <= ? AND max_age >= ? ORDER BY title ASC').all(age, age);
  } else {
    const placeholders = genres.map(() => '?').join(',');
    books = db.prepare(`SELECT * FROM books WHERE genre IN (${placeholders}) AND min_age <= ? AND max_age >= ? ORDER BY title ASC`)
      .all(...genres, age, age);
    if (books.length === 0) {
      books = db.prepare('SELECT * FROM books WHERE min_age <= ? AND max_age >= ? ORDER BY title ASC LIMIT 6').all(age, age);
    }
  }
  res.json(books);
});

// ─── PROFILE ───────────────────────────────────────────
app.get('/api/profile/:id', (req, res) => {
  const profileId = parseInt(req.params.id);
  const user = db.prepare('SELECT id, username, bio, favourite_genres, profile_pic, avatar_config, created_at FROM users WHERE id = ?').get(profileId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.favourite_genres = JSON.parse(user.favourite_genres);
  user.profile_pic_url = user.profile_pic ? `/uploads/${user.profile_pic}` : null;
  user.avatar_config = user.avatar_config ? JSON.parse(user.avatar_config) : null;   // parse ONCE
  const posts = db.prepare(`
    SELECT p.id, p.content, p.tags, p.media, p.type, p.quote_text, p.quote_author, p.quote_book_title, p.created_at,
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count
    FROM posts p WHERE p.author_id = ? ORDER BY p.created_at DESC LIMIT 10
  `).all(profileId);
  posts.forEach(p => {
    try { p.tags = JSON.parse(p.tags); } catch(e) { p.tags = []; }
    p.media_url = p.media ? `/uploads/${p.media}` : null;
  });
  const badges = db.prepare('SELECT badge_name, badge_icon FROM user_badges WHERE user_id = ?').all(profileId);

  // Use the already-parsed object directly – NO double parsing
  const avatarSeed = user.avatar_config ? user.avatar_config.seed : user.username;
  const avatarStyle = user.avatar_config ? user.avatar_config.style : 'adventurer';
  res.json({ user, posts, badges, avatar_seed: avatarSeed, avatar_style: avatarStyle });
});

app.post('/api/profile/upload-picture', upload.single('profile_pic'), (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const filename = req.file.filename;
  db.prepare('UPDATE users SET profile_pic = ? WHERE id = ?').run(filename, userId);
  res.json({ success: true, profile_pic_url: `/uploads/${filename}` });
});

app.put('/api/profile/bio', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { bio } = req.body;
  db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(bio, userId);
  res.json({ success: true });
});

app.put('/api/profile/username', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { newUsername } = req.body;
  if (!newUsername || !newUsername.trim()) return res.status(400).json({ error: 'Username required' });
  const trimmed = newUsername.trim();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(trimmed);
  if (existing && existing.id !== userId) return res.status(400).json({ error: 'Username already taken' });
  db.prepare('UPDATE users SET username = ? WHERE id = ?').run(trimmed, userId);
  res.json({ success: true, username: trimmed });
});

app.put('/api/profile/password', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both fields required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  const user = db.prepare('SELECT password FROM users WHERE id = ?').get(userId);
  if (!user || !user.password) return res.status(400).json({ error: 'Account uses Google login, no password to change' });
  if (!bcrypt.compareSync(currentPassword, user.password)) return res.status(401).json({ error: 'Current password is incorrect' });
  const hash = bcrypt.hashSync(newPassword, saltRounds);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, userId);
  res.json({ success: true });
});

// ─── BOOKS & REVIEWS ───────────────────────────────────
app.get('/api/books', (req, res) => {
  const books = db.prepare('SELECT * FROM books ORDER BY title ASC').all();
  res.json(books);
});

app.get('/api/books/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(parseInt(req.params.id));
  if (!book) return res.status(404).json({ error: 'Book not found' });
  const stats = db.prepare('SELECT AVG(rating) AS avg_rating, COUNT(*) AS count FROM reviews WHERE book_id = ?').get(book.id);
  book.avg_rating = stats.avg_rating ? Math.round(stats.avg_rating * 10) / 10 : null;
  book.review_count = stats.count;
  res.json(book);
});

app.get('/api/books/:id/reviews', (req, res) => {
  const bookId = parseInt(req.params.id);
  const reviews = db.prepare(`
    SELECT r.id, r.rating, r.review_text, r.created_at, u.username
    FROM reviews r JOIN users u ON r.user_id = u.id
    WHERE r.book_id = ? ORDER BY r.created_at DESC
  `).all(bookId);
  res.json(reviews);
});

app.post('/api/books/:id/review', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const bookId = parseInt(req.params.id);
  const { rating, review_text } = req.body;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating 1-5 required' });
  const existing = db.prepare('SELECT id FROM reviews WHERE user_id = ? AND book_id = ?').get(userId, bookId);
  if (existing) {
    db.prepare('UPDATE reviews SET rating = ?, review_text = ? WHERE id = ?').run(rating, review_text || '', existing.id);
  } else {
    db.prepare('INSERT INTO reviews (user_id, book_id, rating, review_text) VALUES (?, ?, ?, ?)').run(userId, bookId, rating, review_text || '');
  }
  updateChallengeProgress(userId, 'rating');
  if (review_text && review_text.trim().length > 0) updateChallengeProgress(userId, 'review');
  if (review_text && review_text.length >= 100) updateChallengeProgress(userId, 'detailed_review');
  if (rating == 1 || rating == 5) updateChallengeProgress(userId, 'extreme_rating');
  res.json({ success: true });
});

// ─── GOOGLE BOOKS DISCOVER ─────────────────────────────
app.get('/api/discover', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const query = req.query.q?.trim();
  if (!query) return res.json({ items: [] });
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY || '';
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&key=${apiKey}`;
  https.get(url, (googleRes) => {
    let data = '';
    googleRes.on('data', chunk => data += chunk);
    googleRes.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        const books = (parsed.items || []).map(item => {
          const info = item.volumeInfo;
          return {
            id: item.id,
            title: info.title,
            authors: info.authors || [],
            publisher: info.publisher || '',
            publishedDate: info.publishedDate || '',
            description: info.description || '',
            pageCount: info.pageCount || 0,
            categories: info.categories || [],
            averageRating: info.averageRating || 0,
            ratingsCount: info.ratingsCount || 0,
            imageLinks: info.imageLinks || {},
            language: info.language || '',
            previewLink: info.previewLink || '',
            infoLink: info.infoLink || ''
          };
        });
        res.json({ items: books });
      } catch(e) {
        res.status(500).json({ error: 'Failed to fetch books' });
      }
    });
  }).on('error', (e) => res.status(500).json({ error: 'Failed to fetch books' }));
});

// ─── READING TIMER ─────────────────────────────────────
app.post('/api/reading-sessions', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { bookId } = req.body;
  if (!bookId) return res.status(400).json({ error: 'bookId required' });
  db.prepare("UPDATE reading_sessions SET end_time = ?, duration_seconds = 0 WHERE user_id = ? AND end_time IS NULL")
    .run(new Date().toISOString(), userId);
  const stmt = db.prepare('INSERT INTO reading_sessions (user_id, book_id, start_time) VALUES (?, ?, ?)');
  const info = stmt.run(userId, bookId, new Date().toISOString());
  res.json({ success: true, sessionId: info.lastInsertRowid });
});

app.put('/api/reading-sessions/:id', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const sessionId = parseInt(req.params.id);
  const { durationSeconds, bookId } = req.body;
  const session = db.prepare('SELECT * FROM reading_sessions WHERE id = ? AND user_id = ?').get(sessionId, userId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  db.prepare('UPDATE reading_sessions SET end_time = ?, duration_seconds = ? WHERE id = ?')
    .run(new Date().toISOString(), durationSeconds || 0, sessionId);
  res.json({ success: true });
});

app.get('/api/reading-sessions/stats', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const totalSeconds = db.prepare('SELECT SUM(duration_seconds) AS total FROM reading_sessions WHERE user_id = ?').get(userId)?.total || 0;
  const sessions = db.prepare('SELECT * FROM reading_sessions WHERE user_id = ? ORDER BY start_time DESC').all(userId);
  const books = db.prepare('SELECT DISTINCT book_id FROM reading_sessions WHERE user_id = ?').all(userId).map(b => b.book_id);
  const days = db.prepare("SELECT DISTINCT date(start_time) AS day FROM reading_sessions WHERE user_id = ? ORDER BY day DESC").all(userId).map(d => d.day);
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  if (days[0] === today || days[0] === getYesterday()) {
    streak = 1;
    for (let i = 1; i < days.length; i++) {
      const prevDay = new Date(days[i-1]);
      prevDay.setDate(prevDay.getDate() - 1);
      if (days[i] === prevDay.toISOString().split('T')[0]) streak++;
      else break;
    }
  }
  function getYesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }
  res.json({ totalSeconds, sessionsCount: sessions.length, booksCount: books.length, streak });
});

// ─── TAG DISCOVERY ─────────────────────────────────────
app.get('/api/tags/:tag', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const tag = req.params.tag;
  const blocked = getBlockedUserIds(userId);
  const posts = db.prepare(`
    SELECT p.id, p.author_id, p.content, p.tags, p.media, p.type, p.quote_text, p.quote_author, p.quote_book_title, p.created_at, u.username,
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
    EXISTS (SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) AS liked
    FROM posts p JOIN users u ON p.author_id = u.id
    WHERE p.tags LIKE ?
    ORDER BY p.created_at DESC LIMIT 50
  `).all(userId, `%${tag}%`);
  let filtered = posts.filter(p => !blocked.includes(p.author_id));
  filtered.forEach(p => {
    try { p.tags = JSON.parse(p.tags); } catch(e) { p.tags = []; }
    p.media_url = p.media ? `/uploads/${p.media}` : null;
  });
  res.json(filtered);
});

// ─── TRENDING TAGS ─────────────────────────────────────
app.get('/api/trending/tags', (req, res) => {
  const weekAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString();
  const posts = db.prepare('SELECT tags FROM posts WHERE created_at >= ?').all(weekAgo);
  const tagCounts = {};
  posts.forEach(post => {
    let tags = [];
    try { tags = JSON.parse(post.tags); } catch(e) {
      if (typeof post.tags === 'string') tags = post.tags.split(',').map(t=>t.trim());
    }
    tags.forEach(tag => {
      tag = tag.trim();
      if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  const sorted = Object.entries(tagCounts)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));
  res.json(sorted);
});

// ─── TRENDING ───────────────────────────────────────────
app.get('/api/trending/posts', (req, res) => {
  const weekAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString();
  const posts = db.prepare(`
    SELECT p.id, p.content, p.author_id, u.username,
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count
    FROM posts p JOIN users u ON p.author_id = u.id
    WHERE p.created_at >= ? ORDER BY like_count DESC LIMIT 10
  `).all(weekAgo);
  res.json(posts);
});

app.get('/api/trending/books', (req, res) => {
  const books = db.prepare(`
    SELECT b.id, b.title, b.author, COUNT(r.user_id) AS count
    FROM reading_list r JOIN books b ON r.book_id = b.id
    GROUP BY b.id ORDER BY count DESC LIMIT 10
  `).all();
  res.json(books);
});

app.get('/api/trending/reviewers', (req, res) => {
  const reviewers = db.prepare(`
    SELECT u.id, u.username, COUNT(r.id) AS count
    FROM reviews r JOIN users u ON r.user_id = u.id
    GROUP BY u.id ORDER BY count DESC LIMIT 10
  `).all();
  res.json(reviewers);
});

// ─── CHALLENGES & BADGES ────────────────────────────────
app.get('/api/challenges', (req, res) => {
  const challenges = db.prepare('SELECT * FROM challenges WHERE is_active = 1').all();
  const userId = getCurrentUserId(req);
  if (userId) {
    challenges.forEach(c => {
      const uc = db.prepare('SELECT progress, completed FROM user_challenges WHERE user_id = ? AND challenge_id = ?').get(userId, c.id);
      c.user_progress = uc ? uc.progress : 0;
      c.user_completed = uc ? !!uc.completed : false;
    });
  }
  res.json(challenges);
});

app.post('/api/challenges/:id/join', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const challengeId = parseInt(req.params.id);
  const existing = db.prepare('SELECT * FROM user_challenges WHERE user_id = ? AND challenge_id = ?').get(userId, challengeId);
  if (!existing) {
    db.prepare('INSERT INTO user_challenges (user_id, challenge_id, progress) VALUES (?, ?, 0)').run(userId, challengeId);
  }
  res.json({ success: true });
});

// ─── NOTIFICATIONS ──────────────────────────────────────
app.get('/api/notifications/count', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { cnt } = db.prepare('SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND read = 0').get(userId);
  res.json({ count: cnt });
});

app.get('/api/notifications', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const notifs = db.prepare(`
    SELECT n.*, u.username AS from_username, u.profile_pic AS from_profile_pic
    FROM notifications n LEFT JOIN users u ON n.from_user_id = u.id
    WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 30
  `).all(userId);
  notifs.forEach(n => { n.from_profile_pic_url = n.from_profile_pic ? `/uploads/${n.from_profile_pic}` : null; });
  res.json(notifs);
});

app.post('/api/notifications/read-all', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(userId);
  res.json({ success: true });
});

// ─── HELPERS ────────────────────────────────────────────
function getCurrentUserId(req) {
  if (req.isAuthenticated && req.isAuthenticated()) return req.user.id;
  if (req.session && req.session.userId) return req.session.userId;
  return null;
}

function createNotification(userId, type, fromUserId, postId = null, commentId = null) {
  if (userId === fromUserId) return;
  db.prepare('INSERT INTO notifications (user_id, type, from_user_id, post_id, comment_id) VALUES (?, ?, ?, ?, ?)')
    .run(userId, type, fromUserId, postId, commentId);
}

function updateChallengeProgress(userId, actionType, genre = null) {
  const activeChallenges = db.prepare('SELECT * FROM challenges WHERE is_active = 1').all();
  activeChallenges.forEach(challenge => {
    let relevant = false;
    if (challenge.requirement_type === actionType) relevant = true;
    else if (actionType === 'genre_read' && challenge.requirement_type === 'genre_read') {
      if (genre && challenge.name.includes(genre)) relevant = true;
    }
    if (!relevant) return;
    let uc = db.prepare('SELECT * FROM user_challenges WHERE user_id = ? AND challenge_id = ?').get(userId, challenge.id);
    if (!uc) {
      db.prepare('INSERT INTO user_challenges (user_id, challenge_id, progress) VALUES (?, ?, 0)').run(userId, challenge.id);
      uc = { progress: 0, completed: false };
    }
    if (uc.completed) return;
    let newProgress = 0;
    if (challenge.requirement_type === 'unique_genres') {
      const genres = db.prepare(`
        SELECT DISTINCT b.genre FROM reading_list r
        JOIN books b ON r.book_id = b.id
        WHERE r.user_id = ? AND r.status = 'finished'
      `).all(userId);
      newProgress = Math.min(genres.length, challenge.requirement_value);
    } else {
      newProgress = Math.min(uc.progress + 1, challenge.requirement_value);
    }
    db.prepare('UPDATE user_challenges SET progress = ? WHERE user_id = ? AND challenge_id = ?').run(newProgress, userId, challenge.id);
    if (newProgress >= challenge.requirement_value) {
      db.prepare('UPDATE user_challenges SET completed = 1, completed_at = ? WHERE user_id = ? AND challenge_id = ?').run(new Date().toISOString(), userId, challenge.id);
      const badgeExists = db.prepare('SELECT * FROM user_badges WHERE user_id = ? AND badge_name = ?').get(userId, challenge.badge_name);
      if (!badgeExists) {
        db.prepare('INSERT INTO user_badges (user_id, badge_name, badge_icon) VALUES (?, ?, ?)').run(userId, challenge.badge_name, challenge.badge_icon);
      }
    }
  });
}

// ─── YOUR INFO DASHBOARD ─────────────────────────────────
app.get('/api/user/stats', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const friendsCount = db.prepare('SELECT COUNT(*) as count FROM friendships WHERE user_id = ?').get(userId).count;
  const postsCount = db.prepare('SELECT COUNT(*) as count FROM posts WHERE author_id = ?').get(userId).count;

  const totalLikesReceived = db.prepare(`
    SELECT COUNT(*) as count
    FROM likes l JOIN posts p ON l.post_id = p.id
    WHERE p.author_id = ?
  `).get(userId).count;

  const totalCommentsReceived = db.prepare(`
    SELECT COUNT(*) as count
    FROM comments c JOIN posts p ON c.post_id = p.id
    WHERE p.author_id = ?
  `).get(userId).count;

  const mostLikedPost = db.prepare(`
    SELECT p.id, p.content, p.created_at,
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count
    FROM posts p
    WHERE p.author_id = ?
    ORDER BY like_count DESC
    LIMIT 1
  `).get(userId);

  const mostInteractedPost = db.prepare(`
    SELECT p.id, p.content, p.created_at,
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) +
    (SELECT COUNT(*) FROM comments WHERE post_id = p.id) +
    (SELECT COUNT(*) FROM comments WHERE parent_id IN (SELECT id FROM comments WHERE post_id = p.id))
    as interaction_count
    FROM posts p
    WHERE p.author_id = ?
    ORDER BY interaction_count DESC
    LIMIT 1
  `).get(userId);

  const recentPost = db.prepare(`
    SELECT p.id, p.content, p.created_at,
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
    (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
    FROM posts p
    WHERE p.author_id = ?
    ORDER BY p.created_at DESC
    LIMIT 1
  `).get(userId);

  const readingStats = {
    totalSeconds: db.prepare('SELECT SUM(duration_seconds) as total FROM reading_sessions WHERE user_id = ?').get(userId)?.total || 0,
    sessionsCount: db.prepare('SELECT COUNT(*) as count FROM reading_sessions WHERE user_id = ?').get(userId).count,
    booksFinished: db.prepare("SELECT COUNT(*) as count FROM reading_list WHERE user_id = ? AND status = 'finished'").get(userId).count,
    booksReading: db.prepare("SELECT COUNT(*) as count FROM reading_list WHERE user_id = ? AND status = 'currently_reading'").get(userId).count,
    booksWantToRead: db.prepare("SELECT COUNT(*) as count FROM reading_list WHERE user_id = ? AND status = 'want_to_read'").get(userId).count,
  };

  res.json({
    friendsCount,
    postsCount,
    totalLikesReceived,
    totalCommentsReceived,
    mostLikedPost,
    mostInteractedPost,
    recentPost,
    readingStats
  });
});

// ─── BECAUSE YOU LIKED… ─────────────────────────────────
app.get('/api/because', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const likedPostsTags = db.prepare(`
    SELECT p.tags FROM likes l
    JOIN posts p ON l.post_id = p.id
    WHERE l.user_id = ?
    ORDER BY p.created_at DESC
    LIMIT 100
  `).all(userId);

  const tagCounts = new Map();
  likedPostsTags.forEach(row => {
    let tags = [];
    try { tags = JSON.parse(row.tags); } catch(e) {
      if (typeof row.tags === 'string') tags = row.tags.split(',').map(t => t.trim());
    }
    tags.forEach(tag => {
      if (tag) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  const sortedTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  // Fetch user data without overwriting the outer `user` variable
  const userData = db.prepare('SELECT birth_year, favourite_genres FROM users WHERE id = ?').get(userId);
  const age = userData ? new Date().getFullYear() - userData.birth_year : 13;
  const genres = JSON.parse(userData?.favourite_genres || '[]');

  let recommendedBooks = [];
  if (genres.length === 0) {
    recommendedBooks = db.prepare('SELECT * FROM books WHERE min_age <= ? AND max_age >= ? ORDER BY RANDOM() LIMIT 6').all(age, age);
  } else {
    const placeholders = genres.map(() => '?').join(',');
    recommendedBooks = db.prepare(`SELECT * FROM books WHERE genre IN (${placeholders}) AND min_age <= ? AND max_age >= ? ORDER BY RANDOM() LIMIT 6`)
      .all(...genres, age, age);
    if (recommendedBooks.length === 0) {
      recommendedBooks = db.prepare('SELECT * FROM books WHERE min_age <= ? AND max_age >= ? ORDER BY RANDOM() LIMIT 6').all(age, age);
    }
  }

  let tagBooks = [];
  if (sortedTags.length > 0) {
    const bookPlaceholders = sortedTags.map(() => '?').join(',');
    tagBooks = db.prepare(`
      SELECT * FROM books
      WHERE genre IN (${bookPlaceholders})
        AND min_age <= ? AND max_age >= ?
      ORDER BY RANDOM()
      LIMIT 6
    `).all(...sortedTags, age, age);
  }

  const trendingPosts = db.prepare(`
    SELECT p.id, p.author_id, p.content, p.tags, p.media, p.created_at, u.username,
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count
    FROM posts p JOIN users u ON p.author_id = u.id
    WHERE p.author_id != ?
    ORDER BY p.created_at DESC
    LIMIT 15
  `).all(userId);
  trendingPosts.forEach(p => {
    try { p.tags = JSON.parse(p.tags); } catch(e) { p.tags = []; }
    p.media_url = p.media ? `/uploads/${p.media}` : null;
  });

  let tagPosts = [];
  if (sortedTags.length > 0) {
    const allPosts = db.prepare(`
      SELECT p.id, p.author_id, p.content, p.tags, p.media, p.created_at, u.username,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count
      FROM posts p JOIN users u ON p.author_id = u.id
      WHERE p.author_id != ?
      ORDER BY p.created_at DESC
      LIMIT 100
    `).all(userId);
    tagPosts = allPosts.filter(post => {
      let tags = [];
      try { tags = JSON.parse(post.tags); } catch(e) {
        if (typeof post.tags === 'string') tags = post.tags.split(',').map(t => t.trim());
      }
      return tags.some(t => sortedTags.includes(t));
    }).slice(0, 10);
    tagPosts.forEach(p => {
      try { p.tags = JSON.parse(p.tags); } catch(e) { p.tags = []; }
      p.media_url = p.media ? `/uploads/${p.media}` : null;
    });
  }

  res.json({
    tags: sortedTags,
    recommendedBooks,
    tagBooks,
    trendingPosts,
    tagPosts
  });
});

// ─── AVATAR BUILDER ─────────────────────────────────────
app.get('/api/avatar/config', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const user = db.prepare('SELECT avatar_config FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  try {
    res.json(user.avatar_config ? JSON.parse(user.avatar_config) : null);
  } catch(e) {
    res.json(null);
  }
});

app.put('/api/avatar/config', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const config = req.body;
  if (!config || typeof config !== 'object') return res.status(400).json({ error: 'Invalid config' });
  db.prepare('UPDATE users SET avatar_config = ? WHERE id = ?').run(JSON.stringify(config), userId);
  res.json({ success: true });
});

app.delete('/api/avatar/reset', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  db.prepare('UPDATE users SET avatar_config = NULL WHERE id = ?').run(userId);
  res.json({ success: true });
});
// ─── AI CHAT (ONLINE API – GROQ) ─────────────────────
app.post('/api/ai/chat', async (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message required' });

  // Save user message
  saveChatMessage(userId, 'user', message.trim());

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', { … });

    const data = await response.json();
    const reply = data.choices[0].message.content.trim();

    // Save assistant reply
    saveChatMessage(userId, 'assistant', reply);

    res.json({ reply });
  } catch (err) {
    console.error('❌ API error:', err.message);
    res.status(500).json({ error: 'AI is offline. Check your internet.' });
  }
});
// ─── ENHANCED DASHBOARD STATS ──────────────────────────
app.get('/api/user/monthly-stats', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const months = parseInt(req.query.months) || 12;
  const status = req.query.status || 'finished';

  let rows;
  if (months === 0) {
    // All time
    rows = db.prepare(`
      SELECT strftime('%Y-%m', added_at) AS month, COUNT(*) AS count
      FROM reading_list
      WHERE user_id = ? AND status = ?
      GROUP BY month
      ORDER BY month ASC
    `).all(userId, status);
  } else {
    rows = db.prepare(`
      SELECT strftime('%Y-%m', added_at) AS month, COUNT(*) AS count
      FROM reading_list
      WHERE user_id = ? AND status = ? AND added_at >= date('now', '-${months} months')
      GROUP BY month
      ORDER BY month ASC
    `).all(userId, status);
  }

  // Fill in missing months
  const monthsArr = [];
  const countsArr = [];
  const now = new Date();
  for (let i = months === 0 ? 12 : (months - 1); i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const row = rows.find(r => r.month === key);
    monthsArr.push(key.slice(0,4) + '-' + key.slice(5));
    countsArr.push(row ? row.count : 0);
  }

  res.json({ months: monthsArr, counts: countsArr });
});

app.post('/api/ai/chat', async (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message required' });

  // Save user message
  saveChatMessage(userId, 'user', message.trim());

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'You are Libby, a friendly librarian. Keep answers short, friendly, and about books.' },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 200
      })
    });

    const data = await response.json();

    if (!data.choices || !data.choices.length) {
      console.error('❌ No choices in response:', data);
      return res.status(500).json({ error: 'AI model not available right now.' });
    }

    const reply = data.choices[0].message.content.trim();

    // Save assistant reply
    saveChatMessage(userId, 'assistant', reply);

    res.json({ reply });
  } catch (err) {
    console.error('❌ API error:', err.message);
    res.status(500).json({ error: 'AI is offline. Check your internet.' });
  }
});

// ─── CHAT HISTORY ─────────────────────────────────────
// Save a message (called inside the existing AI chat route)
function saveChatMessage(userId, role, message) {
  db.prepare('INSERT INTO ai_chat_history (user_id, role, message) VALUES (?, ?, ?)').run(userId, role, message);
}

// Retrieve all messages for the logged‑in user
app.get('/api/ai/chat/history', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const history = db.prepare('SELECT role, message, created_at FROM ai_chat_history WHERE user_id = ? ORDER BY created_at ASC').all(userId);
  res.json(history);
});

// Clear chat history
app.delete('/api/ai/chat/history/clear', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  db.prepare('DELETE FROM ai_chat_history WHERE user_id = ?').run(userId);
  res.json({ success: true });
});
// ─── START ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`📚 BookTok running at http://localhost:${PORT}`));