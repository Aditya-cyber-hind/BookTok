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
try { db.exec('ALTER TABLE books ADD COLUMN text_content TEXT DEFAULT NULL'); } catch(e){}
try { db.exec('ALTER TABLE books ADD COLUMN google_books_id TEXT DEFAULT NULL'); } catch(e){}
try { db.exec("ALTER TABLE posts ADD COLUMN type TEXT DEFAULT 'post'"); } catch(e){}
try { db.exec('ALTER TABLE posts ADD COLUMN quote_text TEXT DEFAULT NULL'); } catch(e){}
try { db.exec('ALTER TABLE posts ADD COLUMN quote_author TEXT DEFAULT NULL'); } catch(e){}
try { db.exec('ALTER TABLE posts ADD COLUMN quote_book_title TEXT DEFAULT NULL'); } catch(e){}
try { db.exec('ALTER TABLE users ADD COLUMN private_profile INTEGER DEFAULT 0'); } catch(e){}
try { db.exec('ALTER TABLE users ADD COLUMN avatar_config TEXT DEFAULT NULL'); } catch(e){}
try { db.exec('ALTER TABLE users ADD COLUMN lico_balance INTEGER DEFAULT 0'); } catch(e){}
try { db.exec('ALTER TABLE users ADD COLUMN golden_badge INTEGER DEFAULT 0'); } catch(e){}
try { db.exec('ALTER TABLE users ADD COLUMN libby_upgraded INTEGER DEFAULT 0'); } catch(e){}
try { db.exec('ALTER TABLE users ADD COLUMN premium_dashboard INTEGER DEFAULT 0'); } catch(e){}
try { db.exec('ALTER TABLE users ADD COLUMN reader_cluster INTEGER DEFAULT -1'); } catch(e){}
try { db.exec('ALTER TABLE users ADD COLUMN email TEXT UNIQUE'); } catch(e){}
try { db.exec('ALTER TABLE users ADD COLUMN phone TEXT UNIQUE'); } catch(e){}

db.exec(`
  CREATE TABLE IF NOT EXISTS bingo_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    week_start TEXT NOT NULL,
    card_data TEXT NOT NULL,
    completed_squares TEXT DEFAULT '[]',
    rows_completed INTEGER DEFAULT 0,
    is_full_card INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, week_start)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS award_nominations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    nominee_type TEXT NOT NULL,
    nominee_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, category, nominee_type, nominee_id)
  );

  CREATE TABLE IF NOT EXISTS award_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    nomination_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (nomination_id) REFERENCES award_nominations(id),
    UNIQUE(user_id, nomination_id)
  );
`);

  db.exec(`
  CREATE TABLE IF NOT EXISTS status_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    media TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME DEFAULT (datetime('now', '+24 hours')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// If the table already exists, add the column smoothly
try { db.exec('ALTER TABLE status_updates ADD COLUMN media TEXT DEFAULT NULL'); } catch(e) {}
db.exec(`
  CREATE TABLE IF NOT EXISTS writings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT DEFAULT 'Untitled',
    content TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

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
    role TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS lico_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    related_id INTEGER,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS post_tips (
    post_id INTEGER NOT NULL,
    total INTEGER DEFAULT 0,
    PRIMARY KEY (post_id)
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
// Serve splash screen on first load (no cache)
app.get('/', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'public', 'splash.html'));
});
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static('uploads'));

// Passport Google
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://administrative-cassette-affairs-mixing.trycloudflare.com/auth/google/callback"
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
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => res.redirect('/'));
app.get('/logout', (req, res, next) => { req.logout(err => { if(err) return next(err); res.redirect('/'); }); });

// ─── AUTH ───────────────────────────────────────────────
app.post('/api/signup', (req, res) => {
  const { username, email, password, birth_year, favourite_genres } = req.body;
  if (!username || !password || !birth_year) return res.status(400).json({ error: 'Missing required fields (username, password, birth_year)' });
  
  // Basic email validation (if provided)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email format' });
  
  try {
    const hash = bcrypt.hashSync(password, saltRounds);
    const stmt = db.prepare('INSERT INTO users (username, email, password, birth_year, favourite_genres) VALUES (?, ?, ?, ?, ?)');
    const info = stmt.run(username, email || null, hash, birth_year, JSON.stringify(favourite_genres || []));
    req.session.userId = info.lastInsertRowid;
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      if (err.message.includes('username')) return res.status(400).json({ error: 'Username already taken' });
      if (err.message.includes('email')) return res.status(400).json({ error: 'Email already in use' });
    }
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
app.post('/api/login-email', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid email or password' });
  
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
  const user = db.prepare('SELECT id, username, birth_year, bio, favourite_genres, profile_pic, avatar_config, libby_upgraded, premium_dashboard FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  user.favourite_genres = JSON.parse(user.favourite_genres);
  user.profile_pic_url = user.profile_pic ? `/uploads/${user.profile_pic}` : null;

  let avatarSeed = null, avatarStyle = null;
  if (user.avatar_config) {
    try {
      const config = JSON.parse(user.avatar_config);
      avatarSeed = config.seed || null;
      avatarStyle = config.style || 'adventurer';
    } catch(e) {}
  }

  res.json({
    id: user.id,
    username: user.username,
    birth_year: user.birth_year,
    bio: user.bio,
    favourite_genres: user.favourite_genres,
    profile_pic_url: user.profile_pic_url,
    avatar_seed: avatarSeed,
    avatar_style: avatarStyle,
    libby_upgraded: !!user.libby_upgraded,
    premium_dashboard: !!user.premium_dashboard
  });
});

// ─── FRIEND SYSTEM ──────────────────────────────────────
app.post('/api/friend-request', (req, res) => {
  const fromId = getCurrentUserId(req);
  if (!fromId) return res.status(401).json({ error: 'Not logged in' });
  const { to_username } = req.body;
  const toUser = db.prepare('SELECT id FROM users WHERE username = ?').get(to_username);
  if (!toUser) return res.status(404).json({ error: 'User not found' });
  if (fromId === toUser.id) return res.status(400).json({ error: 'Cannot friend yourself' });
  db.prepare('INSERT OR IGNORE INTO friend_requests (from_id, to_id) VALUES (?, ?)').run(fromId, toUser.id);
  createNotification(toUser.id, 'friend_request', fromId);
  res.json({ success: true });
});

app.get('/api/friend-requests', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const requests = db.prepare(`
    SELECT fr.id, fr.from_id, u.username AS from_username
    FROM friend_requests fr JOIN users u ON fr.from_id = u.id
    WHERE fr.to_id = ? AND fr.status = 'pending'
  `).all(userId);
  res.json(requests);
});

app.post('/api/friend-respond', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { requestId, accept } = req.body;
  const request = db.prepare('SELECT * FROM friend_requests WHERE id = ? AND to_id = ?').get(requestId, userId);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (accept) {
    db.prepare('DELETE FROM friend_requests WHERE id = ?').run(requestId);
    db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)').run(userId, request.from_id);
    db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)').run(request.from_id, userId);
    createNotification(request.from_id, 'friend_accepted', userId);
  } else {
    db.prepare('DELETE FROM friend_requests WHERE id = ?').run(requestId);
  }
  res.json({ success: true });
});

app.get('/api/friends', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const friends = db.prepare(`
    SELECT u.id, u.username FROM friendships f
    JOIN users u ON f.friend_id = u.id
    WHERE f.user_id = ?
  `).all(userId);
  res.json(friends);
});

app.post('/api/posts', upload.single('media'), (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  let content = req.body.content || '';
  let tags = req.body.tags || '';
  let type = req.body.type || 'post';
  let quote_text = req.body.quote_text || null;
  let quote_author = req.body.quote_author || null;
  let quote_book_title = req.body.quote_book_title || null;

  if (!content && !quote_text && !req.file) return res.status(400).json({ error: 'Content or media required' });

  const media = req.file ? req.file.filename : null;
  const tagsArray = tags.split(',').map(t => t.trim()).filter(t => t);

  // Automatically detect Short: video file uploaded with duration under 60s
  const isVideo = req.file && req.file.mimetype?.startsWith('video/');
  // We don't have the real duration here without ffprobe, so we'll trust the client to send a flag
  const isShort = req.body.isShort === 'true' || (isVideo && content.toLowerCase().includes('short'));

  const stmt = db.prepare('INSERT INTO posts (author_id, content, tags, media, type, quote_text, quote_author, quote_book_title) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const info = stmt.run(userId, content, JSON.stringify(tagsArray), media, isShort ? 'short' : type, quote_text, quote_author, quote_book_title);
  res.json({ success: true, postId: info.lastInsertRowid, isShort });
});

app.put('/api/posts/:id', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const postId = parseInt(req.params.id);
  const post = db.prepare('SELECT * FROM posts WHERE id = ? AND author_id = ?').get(postId, userId);
  if (!post) return res.status(403).json({ error: 'Not allowed' });
  const { content, tags } = req.body;
  const tagsArray = tags.split(',').map(t => t.trim()).filter(t => t);
  db.prepare('UPDATE posts SET content = ?, tags = ? WHERE id = ?').run(content, JSON.stringify(tagsArray), postId);
  res.json({ success: true });
});

app.delete('/api/posts/:id', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const postId = parseInt(req.params.id);
  const post = db.prepare('SELECT * FROM posts WHERE id = ? AND author_id = ?').get(postId, userId);
  if (!post) return res.status(403).json({ error: 'Not allowed' });

  db.pragma('foreign_keys = OFF');
  db.prepare('DELETE FROM likes WHERE post_id = ?').run(postId);
  db.prepare('DELETE FROM comments WHERE post_id = ?').run(postId);
  db.prepare('DELETE FROM reactions WHERE post_id = ?').run(postId);
  db.prepare('DELETE FROM notifications WHERE post_id = ?').run(postId);
  db.prepare('DELETE FROM post_tips WHERE post_id = ?').run(postId);
  db.prepare('DELETE FROM posts WHERE id = ?').run(postId);
  db.pragma('foreign_keys = ON');

  res.json({ success: true });
});

// Emoji reactions
app.get('/api/posts/:postId/reactions', (req, res) => {
  const reactions = db.prepare('SELECT emoji, COUNT(*) as count FROM reactions WHERE post_id = ? GROUP BY emoji').all(parseInt(req.params.postId));
  res.json(reactions);
});

app.post('/api/posts/:postId/react', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const postId = parseInt(req.params.postId);
  const { emoji } = req.body;
  db.prepare('INSERT OR REPLACE INTO reactions (user_id, post_id, emoji) VALUES (?, ?, ?)').run(userId, postId, emoji);
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
    if (post) createNotification(post.author_id, 'like', userId, postId);
  }
  const count = db.prepare('SELECT COUNT(*) AS count FROM likes WHERE post_id = ?').get(postId).count;
  const liked = !!db.prepare('SELECT * FROM likes WHERE user_id = ? AND post_id = ?').get(userId, postId);
  res.json({ like_count: count, action: liked ? 'liked' : 'unliked' });
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
    COALESCE((SELECT total FROM post_tips WHERE post_id = p.id), 0) AS tips,
    EXISTS (SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) AS liked
    FROM posts p JOIN users u ON p.author_id = u.id
    WHERE p.type != 'short' AND p.author_id IN (${placeholders})`; 
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
    COALESCE((SELECT total FROM post_tips WHERE post_id = p.id), 0) AS tips,
    EXISTS (SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) AS liked
    FROM posts p JOIN users u ON p.author_id = u.id
    WHERE p.type != 'short'`;
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
  
  // ==========================================
  // 📊 SIGNAL 1: Tag Affinity (30% weight)
  // ==========================================
  const likedPosts = db.prepare(`
    SELECT p.tags FROM likes l 
    JOIN posts p ON l.post_id = p.id 
    WHERE l.user_id = ? 
    ORDER BY p.created_at DESC LIMIT 50
  `).all(userId);
  
  const tagScores = new Map();
  likedPosts.forEach(p => {
    let tags = [];
    try { tags = JSON.parse(p.tags); } catch(e) {
      if (typeof p.tags === 'string' && p.tags.trim().length > 0) tags = p.tags.split(',').map(t => t.trim());
    }
    tags.forEach(tag => tagScores.set(tag, (tagScores.get(tag) || 0) + 1));
  });
  
  // ==========================================
  // 📚 SIGNAL 2: Genre Affinity (25% weight)
  // ==========================================
  const userGenres = db.prepare(`
    SELECT b.genre, COUNT(*) as cnt FROM reading_list r
    JOIN books b ON r.book_id = b.id
    WHERE r.user_id = ? AND r.status = 'finished'
    GROUP BY b.genre ORDER BY cnt DESC LIMIT 5
  `).all(userId);
  
  const genreScores = new Map();
  userGenres.forEach(g => genreScores.set(g.genre, g.cnt));
  
  // ==========================================
  // 👥 SIGNAL 3: Friend Activity (20% weight)
  // ==========================================
  const friends = db.prepare('SELECT friend_id FROM friendships WHERE user_id = ?').all(userId).map(f => f.friend_id);
  const friendPosts = new Map();
  if (friends.length > 0) {
    const friendActivity = db.prepare(`
      SELECT p.id, p.author_id FROM posts p 
      WHERE p.author_id IN (${friends.map(() => '?').join(',')}) 
      AND p.created_at > datetime('now', '-3 days')
    `).all(...friends);
    friendActivity.forEach(p => friendPosts.set(p.id, 1));
  }
  
  // ==========================================
  // 🚫 BLOCK FILTER
  // ==========================================
  const blocked = getBlockedUserIds(userId);
  
  // ==========================================
  // 🔍 FETCH CANDIDATE POOL
  // ==========================================
  let query = `SELECT p.id, p.author_id, p.content, p.tags, p.media, p.type, 
    p.quote_text, p.quote_author, p.quote_book_title, p.created_at, u.username,
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
    COALESCE((SELECT total FROM post_tips WHERE post_id = p.id), 0) AS tips
    FROM posts p JOIN users u ON p.author_id = u.id
    WHERE p.type != 'short' 
    AND p.author_id != ?
    AND p.id NOT IN (SELECT post_id FROM likes WHERE user_id = ?)`;
  
  const params = [userId, userId];
  if (blocked.length > 0) {
    query += ` AND p.author_id NOT IN (${blocked.map(() => '?').join(',')})`;
    params.push(...blocked);
  }
  query += ' ORDER BY p.created_at DESC LIMIT 300';
  
  let candidates = db.prepare(query).all(...params);
  
  // ==========================================
  // 🧮 COMPOSITE SCORING
  // ==========================================
  const scored = candidates.map(post => {
    let tags = [];
    try { tags = JSON.parse(post.tags); } catch(e) {}
    
    // Signal 1: Tag Match (30%)
    let tagScore = 0;
    tags.forEach(tag => { if (tagScores.has(tag)) tagScore += tagScores.get(tag); });
    const maxTagScore = Math.max(...Array.from(tagScores.values()), 1);
    const normalizedTag = Math.min(tagScore / maxTagScore, 1) * 0.30;
    
    // Signal 2: Genre Match (25%)
    let genreScore = 0;
    tags.forEach(tag => {
      const lower = tag.toLowerCase();
      genreScores.forEach((count, genre) => {
        if (lower.includes(genre.toLowerCase()) || genre.toLowerCase().includes(lower)) {
          genreScore += count;
        }
      });
    });
    const maxGenreScore = Math.max(...Array.from(genreScores.values()), 1);
    const normalizedGenre = Math.min(genreScore / maxGenreScore, 1) * 0.25;
    
    // Signal 3: Friend Activity (20%)
    const friendBoost = friendPosts.has(post.id) ? 0.20 : 0;
    
    // Signal 4: Recency (15%)
    const hoursAgo = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
    const recencyScore = Math.max(0, (72 - hoursAgo) / 72) * 0.15;
    
    // Signal 5: Quality - Community Engagement (10%)
    const engagementRate = post.like_count > 0 ? Math.min(post.like_count / 10, 1) * 0.10 : 0;
    
    const totalScore = normalizedTag + normalizedGenre + friendBoost + recencyScore + engagementRate;
    
    return { ...post, score: Math.round(totalScore * 100) / 100, tags };
  });
  
  // ==========================================
  // 🎯 RANK & RETURN
  // ==========================================
  scored.sort((a, b) => b.score - a.score);
  
  // Add some diversity - don't show more than 2 posts from same author in top 10
  const seenAuthors = new Map();
  const result = [];
  for (const post of scored) {
    const authorCount = seenAuthors.get(post.author_id) || 0;
    if (authorCount < 2 || result.length > 20) {
      result.push(post);
      seenAuthors.set(post.author_id, authorCount + 1);
    }
    if (result.length >= 30) break;
  }
  
  result.forEach(p => {
    p.media_url = p.media ? `/uploads/${p.media}` : null;
    p.liked = false;
  });
  
  res.json(result);
});
// ─── SEARCH ──────────────────────────────────────────────
app.get('/api/search', (req, res) => {
  const q = `%${req.query.q || ''}%`;
  const users = db.prepare('SELECT id, username FROM users WHERE username LIKE ? LIMIT 5').all(q);
  const posts = db.prepare('SELECT p.id, p.content, p.author_id, u.username FROM posts p JOIN users u ON p.author_id = u.id WHERE p.content LIKE ? LIMIT 5').all(q);
  const books = db.prepare('SELECT id, title, author FROM books WHERE title LIKE ? OR author LIKE ? LIMIT 5').all(q, q);
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
    awardLiCo(userId, 5, 'finished_book', bookId);
  }
  if (status === 'want_to_read') updateChallengeProgress(userId, 'want_to_read');
  res.json({ success: true });
});

app.get('/api/reading-list', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const list = db.prepare(`
    SELECT b.id, b.title, b.author, r.status, r.progress, r.total_pages
    FROM reading_list r JOIN books b ON r.book_id = b.id
    WHERE r.user_id = ?
  `).all(userId);
  res.json(list);
});

// ─── BLOCK / REPORT ─────────────────────────────────────
app.post('/api/block/:userId', (req, res) => {
  const blockerId = getCurrentUserId(req);
  if (!blockerId) return res.status(401).json({ error: 'Not logged in' });
  const blockedId = parseInt(req.params.userId);
  const existing = db.prepare('SELECT * FROM blocks WHERE blocker_id = ? AND blocked_id = ?').get(blockerId, blockedId);
  if (existing) {
    db.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?').run(blockerId, blockedId);
    res.json({ blocked: false });
  } else {
    db.prepare('INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)').run(blockerId, blockedId);
    res.json({ blocked: true });
  }
});

app.post('/api/report', (req, res) => {
  const reporterId = getCurrentUserId(req);
  if (!reporterId) return res.status(401).json({ error: 'Not logged in' });
  const { reported_user_id, post_id, reason } = req.body;
  db.prepare('INSERT INTO reports (reporter_id, reported_user_id, post_id, reason) VALUES (?, ?, ?, ?)').run(reporterId, reported_user_id, post_id || null, reason || '');
  res.json({ success: true });
});

// ─── COMMENTS ───────────────────────────────────────────
app.get('/api/posts/:postId/comments', (req, res) => {
  const postId = parseInt(req.params.postId);
  const comments = db.prepare(`
    SELECT c.id, c.user_id, u.username, c.content, c.parent_id, c.created_at
    FROM comments c JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `).all(postId);
  const commentMap = {};
  const topLevel = [];
  comments.forEach(c => {
    commentMap[c.id] = { ...c, replies: [] };
  });
  comments.forEach(c => {
    if (c.parent_id && commentMap[c.parent_id]) {
      commentMap[c.parent_id].replies.push(commentMap[c.id]);
    } else {
      topLevel.push(commentMap[c.id]);
    }
  });
  res.json(comments.map(c => {
    const cm = commentMap[c.id];
    return {
      id: cm.id,
      user_id: cm.user_id,
      username: cm.username,
      content: cm.content,
      parent_id: cm.parent_id,
      created_at: cm.created_at,
      replies: cm.replies
    };
  }).filter(c => !c.parent_id));
});

app.post('/api/posts/:postId/comments', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const postId = parseInt(req.params.postId);
  const { content, parent_id } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  const postExists = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
  if (!postExists) return res.status(404).json({ error: 'Post not found' });
  db.prepare('INSERT INTO comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)').run(postId, userId, content, parent_id || null);
  const post = db.prepare('SELECT author_id FROM posts WHERE id = ?').get(postId);
  if (post && post.author_id !== userId) {
    createNotification(post.author_id, 'comment', userId, postId);
  }
  res.json({ success: true });
});

// ─── RECOMMENDATIONS ────────────────────────────────────
app.get('/api/recommendations', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const user = db.prepare('SELECT favourite_genres FROM users WHERE id = ?').get(userId);
  const genres = JSON.parse(user.favourite_genres);
  let books = [];
  if (genres.length > 0) {
    const placeholders = genres.map(() => '?').join(',');
    books = db.prepare(`SELECT * FROM books WHERE genre IN (${placeholders}) LIMIT 5`).all(...genres);
  }
  if (books.length === 0) {
    books = db.prepare('SELECT * FROM books ORDER BY RANDOM() LIMIT 5').all();
  }
  res.json(books);
});

// ─── PROFILE ───────────────────────────────────────────
app.get('/api/profile/:id', (req, res) => {
  const profileId = parseInt(req.params.id);
  const user = db.prepare('SELECT id, username, bio, favourite_genres, profile_pic, avatar_config, golden_badge, created_at FROM users WHERE id = ?').get(profileId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.favourite_genres = JSON.parse(user.favourite_genres);
  user.profile_pic_url = user.profile_pic ? `/uploads/${user.profile_pic}` : null;
  user.avatar_config = user.avatar_config ? JSON.parse(user.avatar_config) : null;
  const posts = db.prepare(`
    SELECT p.id, p.content, p.tags, p.media, p.type, p.quote_text, p.quote_author, p.quote_book_title, p.created_at,
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
    COALESCE((SELECT total FROM post_tips WHERE post_id = p.id), 0) AS tips
    FROM posts p WHERE p.author_id = ? ORDER BY p.created_at DESC LIMIT 10
  `).all(profileId);
  posts.forEach(p => {
    try { p.tags = JSON.parse(p.tags); } catch(e) { p.tags = []; }
    p.media_url = p.media ? `/uploads/${p.media}` : null;
  });
  const badges = db.prepare('SELECT badge_name, badge_icon FROM user_badges WHERE user_id = ?').all(profileId);

  const avatarSeed = user.avatar_config ? user.avatar_config.seed : user.username;
  const avatarStyle = user.avatar_config ? user.avatar_config.style : 'adventurer';
  res.json({ user, posts, badges, avatar_seed: avatarSeed, avatar_style: avatarStyle });
});

app.post('/api/profile/upload-picture', upload.single('profile_pic'), (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  if (!req.file) return res.status(400).json({ error: 'No file' });
  db.prepare('UPDATE users SET profile_pic = ? WHERE id = ?').run(req.file.filename, userId);
  res.json({ success: true, profile_pic_url: `/uploads/${req.file.filename}` });
});

app.put('/api/profile/bio', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(req.body.bio || '', userId);
  res.json({ success: true });
});

app.put('/api/profile/username', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const newUsername = req.body.newUsername;
  try {
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(newUsername, userId);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Username taken' });
  }
});

app.put('/api/profile/password', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { currentPassword, newPassword } = req.body;
  const user = db.prepare('SELECT password FROM users WHERE id = ?').get(userId);
  if (!user || !bcrypt.compareSync(currentPassword, user.password)) return res.status(401).json({ error: 'Wrong password' });
  const hash = bcrypt.hashSync(newPassword, saltRounds);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, userId);
  res.json({ success: true });
});

// ─── BOOKS & REVIEWS ───────────────────────────────────
app.get('/api/books', (req, res) => {
  const books = db.prepare(`
    SELECT *, CASE WHEN text_content IS NOT NULL THEN 1 ELSE 0 END AS has_text
    FROM books
  `).all();
  res.json(books);
});
app.get('/api/books/:id', (req, res) => {
  const book = db.prepare(`
    SELECT *, CASE WHEN text_content IS NOT NULL THEN 1 ELSE 0 END AS has_text
    FROM books WHERE id = ?
  `).get(parseInt(req.params.id));
  if (!book) return res.status(404).json({ error: 'Not found' });
  const avg = db.prepare('SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews WHERE book_id = ?').get(book.id);
  book.avg_rating = avg.avg_rating ? Math.round(avg.avg_rating * 10) / 10 : null;
  book.review_count = avg.review_count;
  res.json(book);
});
app.get('/api/books/:id/reviews', (req, res) => {
  const reviews = db.prepare(`
    SELECT r.rating, r.review_text, r.created_at, u.username
    FROM reviews r JOIN users u ON r.user_id = u.id
    WHERE r.book_id = ?
    ORDER BY r.created_at DESC
  `).all(parseInt(req.params.id));
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
  awardLiCo(userId, 3, 'review', bookId);
  res.json({ success: true });
});

// ─── GOOGLE BOOKS DISCOVER ─────────────────────────────
app.get('/api/discover', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.json({ items: [] });
  try {
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=20`;
    const response = await fetch(url);
    const data = await response.json();
    const items = (data.items || []).map(item => {
      const info = item.volumeInfo;
      return {
        title: info.title,
        authors: info.authors,
        publishedDate: info.publishedDate,
        pageCount: info.pageCount,
        imageLinks: info.imageLinks
      };
    });
    res.json({ items });
  } catch (e) {
    res.json({ items: [] });
  }
});

// ─── READING TIMER ─────────────────────────────────────
app.post('/api/reading-sessions', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { bookId } = req.body;
  const stmt = db.prepare('INSERT INTO reading_sessions (user_id, book_id, start_time) VALUES (?, ?, ?)');
  const info = stmt.run(userId, bookId, new Date().toISOString());
  res.json({ success: true, sessionId: info.lastInsertRowid });
});

app.put('/api/reading-sessions/:id', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { durationSeconds, bookId } = req.body;
  db.prepare('UPDATE reading_sessions SET end_time = ?, duration_seconds = ? WHERE id = ? AND user_id = ?').run(new Date().toISOString(), durationSeconds, req.params.id, userId);
  res.json({ success: true });
});

app.get('/api/reading-sessions/stats', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const totalSeconds = db.prepare('SELECT COALESCE(SUM(duration_seconds), 0) as total FROM reading_sessions WHERE user_id = ?').get(userId).total;
  res.json({ totalSeconds });
});

// ─── TAG DISCOVERY ─────────────────────────────────────
app.get('/api/tags/:tag', (req, res) => {
  const tag = req.params.tag;
  const posts = db.prepare("SELECT p.*, u.username FROM posts p JOIN users u ON p.author_id = u.id WHERE p.tags LIKE ? ORDER BY p.created_at DESC LIMIT 30").all(`%${tag}%`);
  posts.forEach(p => {
    try { p.tags = JSON.parse(p.tags); } catch(e) { p.tags = []; }
    p.media_url = p.media ? `/uploads/${p.media}` : null;
  });
  res.json(posts);
});

// ─── TRENDING TAGS ─────────────────────────────────────
app.get('/api/trending/tags', (req, res) => {
  const rows = db.prepare(`SELECT tags FROM posts WHERE created_at > date('now', '-7 days')`).all();
  const freq = {};
  rows.forEach(r => {
    let tags = [];
    try { tags = JSON.parse(r.tags); } catch(e) {}
    tags.forEach(t => freq[t] = (freq[t] || 0) + 1);
  });
  const sorted = Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0,10).map(([tag, count]) => ({ tag, count }));
  res.json(sorted);
});

// ─── TRENDING ───────────────────────────────────────────
app.get('/api/trending/posts', (req, res) => {
  const posts = db.prepare(`
    SELECT p.id, p.content, p.author_id, u.username, COUNT(l.user_id) as like_count
    FROM posts p JOIN users u ON p.author_id = u.id
    WHERE p.type != 'short'
    LEFT JOIN likes l ON p.id = l.post_id
    WHERE p.created_at > date('now', '-7 days')
    GROUP BY p.id
    ORDER BY like_count DESC
    LIMIT 10
  `).all();
  res.json(posts);
});

app.get('/api/trending/books', (req, res) => {
  const books = db.prepare(`
    SELECT b.id, b.title, b.author, COUNT(r.user_id) as count
    FROM books b LEFT JOIN reading_list r ON b.id = r.book_id AND r.status = 'want_to_read'
    WHERE r.added_at > date('now', '-7 days')
    GROUP BY b.id
    ORDER BY count DESC
    LIMIT 10
  `).all();
  res.json(books);
});

app.get('/api/trending/reviewers', (req, res) => {
  const reviewers = db.prepare(`
    SELECT u.id, u.username, COUNT(r.id) as count
    FROM reviews r JOIN users u ON r.user_id = u.id
    WHERE r.created_at > date('now', '-7 days')
    GROUP BY u.id
    ORDER BY count DESC
    LIMIT 10
  `).all();
  res.json(reviewers);
});

// ─── CHALLENGES & BADGES ────────────────────────────────
app.get('/api/challenges', (req, res) => {
  const userId = getCurrentUserId(req);
  const challenges = db.prepare('SELECT * FROM challenges WHERE is_active = 1').all();
  const userChallenges = userId ? db.prepare('SELECT * FROM user_challenges WHERE user_id = ?').all(userId) : [];
  const result = challenges.map(c => {
    const uc = userChallenges.find(uc => uc.challenge_id === c.id);
    return {
      ...c,
      user_progress: uc ? uc.progress : 0,
      user_completed: uc ? !!uc.completed : false
    };
  });
  res.json(result);
});

app.post('/api/challenges/:id/join', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const challengeId = parseInt(req.params.id);
  db.prepare('INSERT OR IGNORE INTO user_challenges (user_id, challenge_id, progress) VALUES (?, ?, 0)').run(userId, challengeId);
  res.json({ success: true });
});

// ─── NOTIFICATIONS ──────────────────────────────────────
app.get('/api/notifications/count', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const count = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0').get(userId).count;
  res.json({ count });
});

app.get('/api/notifications', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const notifs = db.prepare(`
    SELECT n.id, n.type, n.from_user_id, n.post_id, n.created_at, u.username as from_username
    FROM notifications n LEFT JOIN users u ON n.from_user_id = u.id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC LIMIT 30
  `).all(userId);
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
      awardLiCo(userId, 10, 'challenge', challenge.id, `Completed challenge: ${challenge.name}`);
    }
  });
}

function awardLiCo(userId, amount, type, relatedId = null, note = '') {
  db.prepare('UPDATE users SET lico_balance = lico_balance + ? WHERE id = ?').run(amount, userId);
  db.prepare('INSERT INTO lico_transactions (user_id, amount, type, related_id, note) VALUES (?, ?, ?, ?, ?)')
    .run(userId, amount, type, relatedId, note);
}

// ─── YOUR INFO DASHBOARD ─────────────────────────────────
app.get('/api/user/stats', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const friendsCount = db.prepare('SELECT COUNT(*) as count FROM friendships WHERE user_id = ?').get(userId).count;
  const postsCount = db.prepare('SELECT COUNT(*) as count FROM posts WHERE author_id = ?').get(userId).count;
  const totalLikesReceived = db.prepare('SELECT COUNT(*) as count FROM likes l JOIN posts p ON l.post_id = p.id WHERE p.author_id = ?').get(userId).count;
  const totalCommentsReceived = db.prepare('SELECT COUNT(*) as count FROM comments c JOIN posts p ON c.post_id = p.id WHERE p.author_id = ?').get(userId).count;
  const readingStats = db.prepare(`
    SELECT
      SUM(CASE WHEN r.status = 'finished' THEN 1 ELSE 0 END) as booksFinished,
      SUM(CASE WHEN r.status = 'currently_reading' THEN 1 ELSE 0 END) as booksReading,
      SUM(CASE WHEN r.status = 'want_to_read' THEN 1 ELSE 0 END) as booksWantToRead,
      COALESCE(SUM(rs.duration_seconds), 0) as totalSeconds
    FROM reading_list r LEFT JOIN reading_sessions rs ON r.user_id = rs.user_id AND r.book_id = rs.book_id
    WHERE r.user_id = ?
  `).get(userId);
  const mostLikedPost = db.prepare(`
    SELECT p.id, p.content, COUNT(l.user_id) as like_count
    FROM posts p LEFT JOIN likes l ON p.id = l.post_id
    WHERE p.author_id = ?
    GROUP BY p.id
    ORDER BY like_count DESC
    LIMIT 1
  `).get(userId);
  const mostInteractedPost = db.prepare(`
    SELECT p.id, p.content,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) +
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as interaction_count
    FROM posts p
    WHERE p.author_id = ?
    GROUP BY p.id
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
  res.json({ friendsCount, postsCount, totalLikesReceived, totalCommentsReceived, readingStats, mostLikedPost, mostInteractedPost, recentPost });
});

app.get('/api/because', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const tagsRaw = db.prepare(`
    SELECT p.tags FROM likes l
    JOIN posts p ON l.post_id = p.id
    WHERE l.user_id = ?
    ORDER BY p.created_at DESC
    LIMIT 20
  `).all(userId);

  const tagFreq = new Map();
  tagsRaw.forEach(r => {
    let tags = [];
    try {
      tags = JSON.parse(r.tags);
    } catch (e) {
      if (typeof r.tags === 'string' && r.tags.trim().length > 0) {
        tags = r.tags.split(',').map(t => t.trim());
      }
    }
    tags.forEach(t => tagFreq.set(t, (tagFreq.get(t) || 0) + 1));
  });

  const topTags = [...tagFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(e => e[0]);

  let recommendedBooks = [];
  let tagBooks = [];
  let trendingPosts = [];
  let tagPosts = [];

  if (topTags.length > 0) {
    const lowerTags = topTags.map(t => t.toLowerCase());
    const placeholders = lowerTags.map(() => '?').join(',');

    tagBooks = db.prepare(
      `SELECT DISTINCT b.* FROM books b WHERE LOWER(b.genre) IN (${placeholders}) LIMIT 10`
    ).all(...lowerTags);

    recommendedBooks = tagBooks.length > 0 ? tagBooks.slice(0, 5) : 
      db.prepare('SELECT * FROM books ORDER BY RANDOM() LIMIT 5').all();

    const likeClauses = topTags.map(() => 'p.tags LIKE ?').join(' OR ');
    const likeParams = topTags.map(t => `%${t}%`);
    trendingPosts = db.prepare(`
      SELECT p.*, u.username,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE (${likeClauses})
      ORDER BY like_count DESC
      LIMIT 10
    `).all(...likeParams);

    trendingPosts.forEach(p => {
      try { p.tags = JSON.parse(p.tags); } catch(e) { p.tags = []; }
      p.media_url = p.media ? `/uploads/${p.media}` : null;
    });

    tagPosts = topTags.map(tag => {
      const posts = db.prepare(`
        SELECT p.*, u.username,
          (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count
        FROM posts p
        JOIN users u ON p.author_id = u.id
        WHERE p.tags LIKE ?
        ORDER BY p.created_at DESC
        LIMIT 5
      `).all(`%${tag}%`);
      posts.forEach(p => {
        try { p.tags = JSON.parse(p.tags); } catch(e) { p.tags = []; }
        p.media_url = p.media ? `/uploads/${p.media}` : null;
      });
      return { tag, posts };
    });
  } else {
    recommendedBooks = db.prepare('SELECT * FROM books ORDER BY RANDOM() LIMIT 5').all();
  }

  res.json({
    recommendedBooks,
    tagBooks,
    trendingPosts,
    tags: topTags,
    tagPosts
  });
});

// ─── AVATAR BUILDER ─────────────────────────────────────
app.get('/api/avatar/config', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const user = db.prepare('SELECT avatar_config FROM users WHERE id = ?').get(userId);
  if (user.avatar_config) {
    try {
      const config = JSON.parse(user.avatar_config);
      return res.json(config);
    } catch(e) {}
  }
  res.json(null);
});

app.put('/api/avatar/config', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  db.prepare('UPDATE users SET avatar_config = ? WHERE id = ?').run(JSON.stringify(req.body), userId);
  res.json({ success: true });
});

app.delete('/api/avatar/reset', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  db.prepare('UPDATE users SET avatar_config = NULL WHERE id = ?').run(userId);
  res.json({ success: true });
});

// ─── AI CHAT (DYNAMIC SYSTEM PROMPT) ─────────────────────
app.post('/api/ai/chat', async (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message required' });

  saveChatMessage(userId, 'user', message.trim());

  // Check if user upgraded Libby
  const user = db.prepare('SELECT libby_upgraded FROM users WHERE id = ?').get(userId);
  const systemMessage = user.libby_upgraded
    ? 'You are Libby 2.01, a super-smart librarian with broad knowledge. You can talk about any topic, not just books. Keep answers friendly and detailed.You were created by Aditya Choudhary who is an eight grader from India.'
    : 'You are Libby, a friendly librarian. Keep answers short, friendly, and about books.You were created by Aditya Choudhary who is an eight grader from India.';

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
          { role: 'system', content: systemMessage },
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
    saveChatMessage(userId, 'assistant', reply);
    res.json({ reply });
  } catch (err) {
    console.error('❌ API error:', err.message);
    res.status(500).json({ error: 'AI is offline. Check your internet.' });
  }
});

// ─── CHAT HISTORY ─────────────────────────────────────
function saveChatMessage(userId, role, message) {
  db.prepare('INSERT INTO ai_chat_history (user_id, role, message) VALUES (?, ?, ?)').run(userId, role, message);
}

app.get('/api/ai/chat/history', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const history = db.prepare('SELECT role, message, created_at FROM ai_chat_history WHERE user_id = ? ORDER BY created_at ASC').all(userId);
  res.json(history);
});

app.delete('/api/ai/chat/history/clear', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  db.prepare('DELETE FROM ai_chat_history WHERE user_id = ?').run(userId);
  res.json({ success: true });
});

// ─── LIBBY'S DAILY BOOK PICK ─────────────────────────
let dailyPick = null;
let dailyPickDate = null;

app.get('/api/daily-pick', async (req, res) => {
  const today = new Date().toDateString();
  if (dailyPick && dailyPickDate === today) return res.json({ book: dailyPick });
  const book = db.prepare('SELECT title, author, genre, id FROM books ORDER BY RANDOM() LIMIT 1').get();
  if (!book) return res.json({ book: null });
  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'You are Libby, a friendly librarian. Write a single short, enthusiastic sentence (max 20 words) recommending the book below. Start with a relevant emoji.' },
          { role: 'user', content: `Book: "${book.title}" by ${book.author}. Genre: ${book.genre}.` }
        ],
        max_tokens: 60,
        temperature: 0.9
      })
    });
    const data = await groqRes.json();
    const recommendation = data.choices?.[0]?.message?.content?.trim() || 'A wonderful read!';
    dailyPick = { ...book, recommendation };
    dailyPickDate = today;
    res.json({ book: dailyPick });
  } catch (e) {
    dailyPick = { ...book, recommendation: 'A highly recommended book!' };
    dailyPickDate = today;
    res.json({ book: dailyPick });
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

app.get('/api/user/genre-stats', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const status = req.query.status || 'finished';
  const rows = db.prepare(`
    SELECT b.genre, COUNT(*) AS count
    FROM reading_list r
    JOIN books b ON r.book_id = b.id
    WHERE r.user_id = ? AND r.status = ?
    GROUP BY b.genre
    ORDER BY count DESC
  `).all(userId, status);
  const labels = rows.map(r => r.genre);
  const values = rows.map(r => r.count);
  res.json({ labels, values });
});

// ─── PREMIUM DASHBOARD ENDPOINTS ───────────────────────
app.get('/api/user/reading-pace', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const user = db.prepare('SELECT premium_dashboard FROM users WHERE id = ?').get(userId);
  if (!user.premium_dashboard) return res.status(403).json({ error: 'Premium dashboard required' });

  const rows = db.prepare(`
    SELECT strftime('%Y-%m', r.added_at) as month, 
           SUM(r.progress) as total_pages
    FROM reading_list r
    WHERE r.user_id = ? AND r.status = 'currently_reading'
    GROUP BY month
    ORDER BY month ASC
  `).all(userId);
  const monthsArr = [];
  const pagesArr = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const row = rows.find(r => r.month === key);
    monthsArr.push(key.slice(0,4) + '-' + key.slice(5));
    pagesArr.push(row ? row.total_pages : 0);
  }
  res.json({ months: monthsArr, pages: pagesArr });
});

app.get('/api/user/engagement-details', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const user = db.prepare('SELECT premium_dashboard FROM users WHERE id = ?').get(userId);
  if (!user.premium_dashboard) return res.status(403).json({ error: 'Premium dashboard required' });

  const rows = db.prepare(`
    SELECT p.id, p.content, 
           COUNT(DISTINCT l.rowid) as likes, 
           COUNT(DISTINCT c.id) as comments
    FROM posts p
    LEFT JOIN likes l ON p.id = l.post_id
    LEFT JOIN comments c ON p.id = c.post_id
    WHERE p.author_id = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT 20
  `).all(userId);
  res.json(rows);
});

app.get('/api/user/genre-radar', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const user = db.prepare('SELECT premium_dashboard FROM users WHERE id = ?').get(userId);
  if (!user.premium_dashboard) return res.status(403).json({ error: 'Premium dashboard required' });

  const rows = db.prepare(`
    SELECT b.genre, COUNT(*) as count
    FROM reading_list r
    JOIN books b ON r.book_id = b.id
    WHERE r.user_id = ? AND r.status = 'finished'
    GROUP BY b.genre
    ORDER BY count DESC
  `).all(userId);
  res.json({ labels: rows.map(r => r.genre), values: rows.map(r => r.count) });
});

// ─── DELETE ACCOUNT ─────────────────────────────────────
app.delete('/api/account', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  const user = db.prepare('SELECT password FROM users WHERE id = ?').get(userId);
  if (!user || !user.password) {
    return res.status(400).json({ error: 'Account uses Google login – cannot verify password.' });
  }

  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  db.prepare('DELETE FROM ai_chat_history WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM notifications WHERE user_id = ? OR from_user_id = ?').run(userId, userId);
  db.prepare('DELETE FROM reactions WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM likes WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM comments WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM reports WHERE reporter_id = ? OR reported_user_id = ?').run(userId, userId);
  db.prepare('DELETE FROM blocks WHERE blocker_id = ? OR blocked_id = ?').run(userId, userId);
  db.prepare('DELETE FROM friend_requests WHERE from_id = ? OR to_id = ?').run(userId, userId);
  db.prepare('DELETE FROM friendships WHERE user_id = ? OR friend_id = ?').run(userId, userId);
  db.prepare('DELETE FROM reading_list WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM reading_sessions WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM posts WHERE author_id = ?').run(userId);
  db.prepare('DELETE FROM user_challenges WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM user_badges WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM lico_transactions WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM post_tips WHERE post_id IN (SELECT id FROM posts WHERE author_id = ?)').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  req.session.destroy();
  res.json({ success: true });
});

// ─── LiCo SYSTEM ───────────────────────────────────────
app.get('/api/lico/balance', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const user = db.prepare('SELECT lico_balance, golden_badge FROM users WHERE id = ?').get(userId);
  res.json({ balance: user.lico_balance, golden_badge: !!user.golden_badge });
});

app.post('/api/lico/tip', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { postId, amount } = req.body;
  if (!postId || !amount || amount < 1 || amount > 5) return res.status(400).json({ error: 'Tip 1‑5 LiCo' });

  const user = db.prepare('SELECT lico_balance FROM users WHERE id = ?').get(userId);
  if (user.lico_balance < amount) return res.status(400).json({ error: 'Not enough LiCo' });

  db.prepare('UPDATE users SET lico_balance = lico_balance - ? WHERE id = ?').run(amount, userId);
  db.prepare('INSERT INTO lico_transactions (user_id, amount, type, related_id) VALUES (?, ?, ?, ?)')
    .run(userId, -amount, 'tip_sent', postId);

  const existing = db.prepare('SELECT total FROM post_tips WHERE post_id = ?').get(postId);
  if (existing) {
    db.prepare('UPDATE post_tips SET total = total + ? WHERE post_id = ?').run(amount, postId);
  } else {
    db.prepare('INSERT INTO post_tips (post_id, total) VALUES (?, ?)').run(postId, amount);
  }

  const post = db.prepare('SELECT author_id FROM posts WHERE id = ?').get(postId);
  if (post && post.author_id !== userId) {
    createNotification(post.author_id, 'lico_tip', userId, postId);
  }

  res.json({ success: true });
});

app.get('/api/posts/:postId/tips', (req, res) => {
  const tip = db.prepare('SELECT total FROM post_tips WHERE post_id = ?').get(parseInt(req.params.postId));
  res.json({ tips: tip ? tip.total : 0 });
});

app.post('/api/lico/golden-badge', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const user = db.prepare('SELECT lico_balance, golden_badge FROM users WHERE id = ?').get(userId);
  if (user.golden_badge) return res.status(400).json({ error: 'Already have golden badge' });
  if (user.lico_balance < 50) return res.status(400).json({ error: 'Need 50 LiCo' });

  db.prepare('UPDATE users SET lico_balance = lico_balance - 50, golden_badge = 1 WHERE id = ?').run(userId);
  db.prepare('INSERT INTO lico_transactions (user_id, amount, type) VALUES (?, ?, ?)').run(userId, -50, 'golden_badge');
  res.json({ success: true });
});

app.get('/api/user/post-stats', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const months = parseInt(req.query.months) || 12;

  let dateCondition = '';
  if (months > 0) {
    dateCondition = `AND p.created_at >= date('now', '-${months} months')`;
  }

  const rows = db.prepare(`
    SELECT strftime('%Y-%m', p.created_at) as month,
           COUNT(DISTINCT l.rowid) as likes,
           COUNT(DISTINCT c.id) as comments
    FROM posts p
    LEFT JOIN likes l ON p.id = l.post_id
    LEFT JOIN comments c ON p.id = c.post_id
    WHERE p.author_id = ? ${dateCondition}
    GROUP BY month
    ORDER BY month ASC
  `).all(userId);

  const monthsArr = [];
  const likesArr = [];
  const commentsArr = [];
  const now = new Date();
  const totalMonths = months === 0 ? 12 : months;
  for (let i = totalMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const row = rows.find(r => r.month === key);
    monthsArr.push(key.slice(0,4) + '-' + key.slice(5));
    likesArr.push(row ? row.likes : 0);
    commentsArr.push(row ? row.comments : 0);
  }

  res.json({ months: monthsArr, likes: likesArr, comments: commentsArr });
});

app.post('/api/lico/upgrade-libby', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const user = db.prepare('SELECT lico_balance, libby_upgraded FROM users WHERE id = ?').get(userId);
  if (user.libby_upgraded) return res.status(400).json({ error: 'Libby is already upgraded' });
  if (user.lico_balance < 5000) return res.status(400).json({ error: 'Need 5000 LiCo' });

  db.prepare('UPDATE users SET lico_balance = lico_balance - 5000, libby_upgraded = 1 WHERE id = ?').run(userId);
  db.prepare('INSERT INTO lico_transactions (user_id, amount, type) VALUES (?, -5000, ?)').run(userId, 'libby_upgrade');
  res.json({ success: true });
});

app.post('/api/lico/unlock-premium-dashboard', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const user = db.prepare('SELECT lico_balance, premium_dashboard FROM users WHERE id = ?').get(userId);
  if (user.premium_dashboard) return res.status(400).json({ error: 'Premium dashboard already unlocked' });
  if (user.lico_balance < 600) return res.status(400).json({ error: 'Need 600 LiCo' });

  db.prepare('UPDATE users SET lico_balance = lico_balance - 600, premium_dashboard = 1 WHERE id = ?').run(userId);
  db.prepare('INSERT INTO lico_transactions (user_id, amount, type) VALUES (?, -600, ?)').run(userId, 'premium_dashboard');
  res.json({ success: true });
});

// ─── BOOKMATE: AI‑Powered Reading Soulmate Finder ──────
app.get('/api/bookmate', async (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  // 1. Current user's data
  const myBooks = db.prepare(`
    SELECT r.book_id, b.genre
    FROM reading_list r JOIN books b ON r.book_id = b.id
    WHERE r.user_id = ? AND r.status = 'finished'
  `).all(userId);

  const myLikedTagsRaw = db.prepare(`
    SELECT p.tags FROM likes l JOIN posts p ON l.post_id = p.id
    WHERE l.user_id = ?
    ORDER BY p.created_at DESC LIMIT 50
  `).all(userId);

  const myGenres = [...new Set(myBooks.map(b => b.genre))];
  const myBookIds = new Set(myBooks.map(b => b.book_id));
  const myTags = new Set();
  myLikedTagsRaw.forEach(r => {
    try { const tags = JSON.parse(r.tags); tags.forEach(t => myTags.add(t.toLowerCase())); } catch(e) {}
  });

  // 2. Find potential matches (not self, not already friends)
  const candidates = db.prepare(`
    SELECT id, username FROM users
    WHERE id != ? AND id NOT IN (
      SELECT friend_id FROM friendships WHERE user_id = ?
    )
  `).all(userId, userId);

  if (candidates.length === 0) return res.json({ matches: [] });

  // 3. Score each candidate
  const matches = candidates.map(c => {
    const theirBooks = db.prepare(`
      SELECT r.book_id, b.genre FROM reading_list r JOIN books b ON r.book_id = b.id
      WHERE r.user_id = ? AND r.status = 'finished'
    `).all(c.id);

    const theirLikedTagsRaw = db.prepare(`
      SELECT p.tags FROM likes l JOIN posts p ON l.post_id = p.id
      WHERE l.user_id = ?
      ORDER BY p.created_at DESC LIMIT 50
    `).all(c.id);

    const theirGenres = [...new Set(theirBooks.map(b => b.genre))];
    const theirBookIds = new Set(theirBooks.map(b => b.book_id));
    const theirTags = new Set();
    theirLikedTagsRaw.forEach(r => {
      try { const tags = JSON.parse(r.tags); tags.forEach(t => theirTags.add(t.toLowerCase())); } catch(e) {}
    });

    // Jaccard similarity functions
    const jaccard = (setA, setB) => {
      const intersection = new Set([...setA].filter(x => setB.has(x)));
      const union = new Set([...setA, ...setB]);
      return union.size === 0 ? 0 : intersection.size / union.size;
    };

    const bookSim = jaccard(myBookIds, theirBookIds);
    const genreSim = jaccard(new Set(myGenres), new Set(theirGenres));
    const tagSim = jaccard(myTags, theirTags);

    // Weighted score (books most important)
    const score = (bookSim * 0.5) + (genreSim * 0.3) + (tagSim * 0.2);

    return {
      userId: c.id,
      username: c.username,
      score: Math.round(score * 10000) / 100,
      commonBooks: [...new Set([...myBookIds].filter(x => theirBookIds.has(x)))],
      commonGenres: [...new Set(myGenres.filter(g => theirGenres.includes(g)))],
      commonTags: [...new Set([...myTags].filter(t => theirTags.has(t)))],
      // We'll fill compatibilityNote later for top matches
      compatibilityNote: null
    };
  });

  // 4. Sort by score descending and take top 3
  matches.sort((a, b) => b.score - a.score);
  const topMatches = matches.slice(0, 3);

  // 5. Generate AI compatibility note for the #1 match only (save Groq tokens)
  if (topMatches.length > 0 && topMatches[0].score > 0) {
    const match = topMatches[0];
    const commonItems = [...match.commonGenres, ...match.commonTags].join(', ') || 'reading';
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: 'You are Libby, a quirky librarian matchmaker. Write a single enthusiastic sentence (max 25 words) explaining why two readers are perfect book buddies based on their shared interests. Use emojis.' },
            { role: 'user', content: `Reader A likes: ${commonItems}. Reader B also likes them. Tell them they are reading soulmates!` }
          ],
          max_tokens: 60,
          temperature: 0.9
        })
      });
      const data = await groqRes.json();
      match.compatibilityNote = data.choices?.[0]?.message?.content?.trim() || 'You’re a perfect reading match! 📚✨';
    } catch (e) {
      match.compatibilityNote = 'You two were made for reading together! 📚';
    }
  }

  res.json({ matches: topMatches });
});
app.get('/api/user/reader-cluster', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  // Get finished books grouped by genre
  const rows = db.prepare(`
    SELECT b.genre, COUNT(*) as cnt
    FROM reading_list r
    JOIN books b ON r.book_id = b.id
    WHERE r.user_id = ? AND r.status = 'finished'
    GROUP BY b.genre
    ORDER BY cnt DESC
  `).all(userId);

  const genreLabels = {
    'Fantasy': '📚 Fantasy Fanatics',
    'Dystopian': '🥀 Dystopian Detectives',
    'Romance': '💕 Romance Romantics',
    'Historical Fiction': '📜 History Buffs',
    'Sci‑Fi': '🚀 Sci‑Fi Explorers',
    'Mystery': '🕵️ Mystery Lovers',
    'Horror': '😱 Horror Enthusiasts',
    'Non‑Fiction': '📊 Non‑Fiction Nerds',
    'Classics': '🎭 Classics Connoisseurs',
    'Children': '🌈 Diverse Readers',
    'Comedy': '😄 Comedy Connoisseurs',
    'Adventure': '🧭 Adventure Seekers',
    'Thriller': '🔪 Thriller Fans',
    'Poetry': '✒️ Poetic Souls',
    'Graphic Novel': '🎨 Visual Storytellers',
    'Biography': '👤 Biography Buffs',
    'Self‑Help': '🌱 Self‑Improvers',
    'Science': '🔬 Science Enthusiasts'
  };

  let cluster = 'Undefined';
  let description = 'Read more to discover your personality!';

  if (rows.length > 0) {
    const topGenre = rows[0].genre;
    if (genreLabels[topGenre]) {
      cluster = genreLabels[topGenre];
      // A short description for each genre
      const descriptions = {
        'Fantasy': 'Magical worlds, epic quests, and mythical creatures define you.',
        'Dystopian': 'You love dark futures, rebellions, and thought‑provoking societies.',
        'Romance': 'Heartwarming tales, love stories, and emotional rollercoasters.',
        'Historical Fiction': 'You dive into the past to understand the present.',
        'Sci‑Fi': 'Spaceships, aliens, and futuristic tech keep you reading late.',
        'Mystery': 'Puzzles, whodunits, and suspense are your bread and butter.',
        'Horror': 'Thrills, chills, and things that go bump in the night.',
        'Non‑Fiction': 'Facts, biographies, and real‑world knowledge fuel your curiosity.',
        'Classics': 'Timeless literature and classic authors are your true love.',
        'Children': 'You read widely – no genre can contain you!',
        'Comedy': 'Laughter is your favourite co‑author.',
        'Adventure': 'Daring quests and uncharted lands call your name.',
        'Thriller': 'Heart‑pounding suspense keeps you turning pages.',
        'Poetry': 'Your soul speaks in verse and stanzas.',
        'Graphic Novel': 'Art and story collide in your favourite reads.',
        'Biography': 'You devour real‑life stories of fascinating people.',
        'Self‑Help': 'Always growing, always becoming better.',
        'Science': 'The universe’s secrets are your playground.'
      };
      description = descriptions[topGenre] || description;
    }
  }

  res.json({ cluster, description });
});
app.get('/api/books/:id/preview', (req, res) => {
  const book = db.prepare('SELECT google_books_id FROM books WHERE id = ?').get(parseInt(req.params.id));
  if (!book || !book.google_books_id) return res.status(404).json({ error: 'No preview available' });
  res.json({ previewUrl: `https://books.google.com/books?id=${book.google_books_id}&printsec=frontcover&output=embed` });
});
// Serve full book text
app.get('/api/books/:id/text', (req, res) => {
  const book = db.prepare('SELECT title, author, text_content FROM books WHERE id = ?').get(parseInt(req.params.id));
  if (!book || !book.text_content) return res.status(404).json({ error: 'Full text not available' });
  res.json({
    title: book.title,
    author: book.author,
    text: book.text_content
  });
});
// ─── WRITO AI WRITING ASSISTANT ──────────────────────────
app.post('/api/writo/generate', async (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { prompt, context } = req.body;  // context = what the user has already written
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });

  const systemMsg = `You are Writo, a creative writing assistant inside BookTok. 
You help users write stories, poems, essays, or any kind of book. 
Keep your responses focused on writing – offer ideas, expand on their prompt, 
or provide a paragraph of story based on their description. 
Be encouraging and imaginative. 
Limit your response to 300 words.`;

  const userMsg = context 
    ? `Here is what I have written so far:\n\n${context}\n\nBased on that, ${prompt}`
    : prompt;

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
          { role: 'system', content: systemMsg },
          { role: 'user', content: userMsg }
        ],
        temperature: 0.9,
        max_tokens: 400
      })
    });
    const data = await response.json();
    if (!data.choices || !data.choices.length) {
      return res.status(500).json({ error: 'AI not available' });
    }
    const reply = data.choices[0].message.content.trim();
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: 'AI failed' });
  }
});

// ─── WRITO SAVE / LOAD WRITINGS ─────────────────────────
app.post('/api/writings', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { title, content, id } = req.body; // if id exists, update; else insert
  if (!content && !title) return res.status(400).json({ error: 'Content required' });

  if (id) {
    db.prepare('UPDATE writings SET title=?, content=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?')
      .run(title || 'Untitled', content, id, userId);
    res.json({ success: true, id });
  } else {
    const info = db.prepare('INSERT INTO writings (user_id, title, content) VALUES (?, ?, ?)')
      .run(userId, title || 'Untitled', content);
    res.json({ success: true, id: info.lastInsertRowid });
  }
});

app.get('/api/writings', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const writings = db.prepare('SELECT id, title, updated_at FROM writings WHERE user_id=? ORDER BY updated_at DESC').all(userId);
  res.json(writings);
});

app.get('/api/writings/:id', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const writing = db.prepare('SELECT * FROM writings WHERE id=? AND user_id=?').get(parseInt(req.params.id), userId);
  if (!writing) return res.status(404).json({ error: 'Not found' });
  res.json(writing);
});

app.delete('/api/writings/:id', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  db.prepare('DELETE FROM writings WHERE id=? AND user_id=?').run(parseInt(req.params.id), userId);
  res.json({ success: true });
});
// ─── WRITO FOLDERS & PUBLISHING ─────────────────────────
// Folders table
db.exec(`
  CREATE TABLE IF NOT EXISTS writo_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);
try { db.exec('ALTER TABLE writings ADD COLUMN folder_id INTEGER DEFAULT NULL'); } catch(e){}
try { db.exec('ALTER TABLE writings ADD COLUMN is_favourite INTEGER DEFAULT 0'); } catch(e){}
try { db.exec('ALTER TABLE writings ADD COLUMN cover_url TEXT DEFAULT NULL'); } catch(e){}

// Get folders
app.get('/api/writo/folders', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const folders = db.prepare('SELECT * FROM writo_folders WHERE user_id = ?').all(userId);
  res.json(folders);
});

// Create folder
app.post('/api/writo/folders', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { name } = req.body;
  const info = db.prepare('INSERT INTO writo_folders (user_id, name) VALUES (?, ?)').run(userId, name);
  res.json({ success: true, id: info.lastInsertRowid });
});

// Delete folder
app.delete('/api/writo/folders/:id', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  db.prepare('DELETE FROM writo_folders WHERE id = ? AND user_id = ?').run(parseInt(req.params.id), userId);
  res.json({ success: true });
});

// Toggle favourite
app.post('/api/writings/:id/favourite', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const writing = db.prepare('SELECT * FROM writings WHERE id = ? AND user_id = ?').get(parseInt(req.params.id), userId);
  if (!writing) return res.status(404).json({ error: 'Not found' });
  const newVal = writing.is_favourite ? 0 : 1;
  db.prepare('UPDATE writings SET is_favourite = ? WHERE id = ?').run(newVal, parseInt(req.params.id));
  res.json({ success: true, is_favourite: !!newVal });
});

// Update writing folder
app.put('/api/writings/:id/folder', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { folder_id } = req.body;
  db.prepare('UPDATE writings SET folder_id = ? WHERE id = ? AND user_id = ?').run(folder_id, parseInt(req.params.id), userId);
  res.json({ success: true });
});

// Goal & streak
try { db.exec('ALTER TABLE users ADD COLUMN daily_word_goal INTEGER DEFAULT 500'); } catch(e){}
try { db.exec('ALTER TABLE users ADD COLUMN current_streak INTEGER DEFAULT 0'); } catch(e){}
try { db.exec('ALTER TABLE users ADD COLUMN last_writing_date TEXT DEFAULT NULL'); } catch(e){}

app.get('/api/writo/goal', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const user = db.prepare('SELECT daily_word_goal, current_streak, last_writing_date FROM users WHERE id = ?').get(userId);
  res.json(user);
});

app.put('/api/writo/goal', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { goal } = req.body;
  db.prepare('UPDATE users SET daily_word_goal = ? WHERE id = ?').run(goal, userId);
  res.json({ success: true });
});

// Update streak when writing
app.post('/api/writo/streak', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const today = new Date().toISOString().split('T')[0];
  const user = db.prepare('SELECT last_writing_date, current_streak FROM users WHERE id = ?').get(userId);
  const lastDate = user.last_writing_date ? new Date(user.last_writing_date).toISOString().split('T')[0] : null;

  if (lastDate !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    if (lastDate === yesterdayStr) {
      db.prepare('UPDATE users SET current_streak = current_streak + 1, last_writing_date = ? WHERE id = ?').run(today, userId);
      if ((user.current_streak + 1) % 7 === 0) awardLiCo(userId, 5, 'writing_streak');
    } else {
      db.prepare('UPDATE users SET current_streak = 1, last_writing_date = ? WHERE id = ?').run(today, userId);
    }
  }
  res.json({ success: true });
});

// Publish to feed
app.post('/api/writo/publish', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content required' });

  // Strip HTML tags and convert to plain text
  const plainText = content.replace(/<[^>]*>/g, '').trim();
  if (!plainText) return res.status(400).json({ error: 'Content empty after stripping HTML' });

  const stmt = db.prepare('INSERT INTO posts (author_id, content, tags, type, quote_text, quote_author, quote_book_title) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const info = stmt.run(userId, title, JSON.stringify(['WritoStory']), 'quote', plainText, 'Writo', '');
  res.json({ success: true, postId: info.lastInsertRowid });
});
// ─── STORIES PAGE ─────────────────────────────────────
app.get('/api/stories', (req, res) => {
  const stories = db.prepare(`
    SELECT p.*, u.username
    FROM posts p JOIN users u ON p.author_id = u.id
    WHERE p.type != 'short' AND p.tags LIKE '%WritoStory%'
    ORDER BY p.created_at DESC
    LIMIT 50
  `).all();
  stories.forEach(s => {
    try { s.tags = JSON.parse(s.tags); } catch(e) { s.tags = []; }
  });
  res.json(stories);
});

// ─── STATUS UPDATES ────────────────────────────────────
app.post('/api/status', upload.single('media'), (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const content = req.body.content || '';
  const media = req.file ? req.file.filename : null;

  // must have at least text or media
  if (!content.trim() && !media) return res.status(400).json({ error: 'Status cannot be empty' });

  db.prepare('INSERT INTO status_updates (user_id, content, media) VALUES (?, ?, ?)')
    .run(userId, content.trim(), media);
  res.json({ success: true, media_url: media ? `/uploads/${media}` : null });
});
app.get('/api/status/:userId', (req, res) => {
  const statuses = db.prepare(`
    SELECT id, content, media, created_at, expires_at
    FROM status_updates
    WHERE user_id = ? AND expires_at > datetime('now')
    ORDER BY created_at DESC
    LIMIT 5
  `).all(parseInt(req.params.userId));
  // Add full URL for media
  const result = statuses.map(s => ({
    ...s,
    media_url: s.media ? `/uploads/${s.media}` : null
  }));
  res.json(result);
});
app.delete('/api/status/:id', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const status = db.prepare('SELECT * FROM status_updates WHERE id = ? AND user_id = ?').get(parseInt(req.params.id), userId);
  if (!status) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM status_updates WHERE id = ?').run(status.id);
  res.json({ success: true });
});
app.post('/api/writo/generate-cover', async (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { prompt, writingId } = req.body;
  if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'Prompt required' });

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt.trim() }]
          }],
          generationConfig: {
            responseModalities: ['IMAGE']
          }
        })
      }
    );

    const data = await response.json();

    if (!data.candidates || !data.candidates.length) {
      console.error('Gemini error:', JSON.stringify(data).substring(0, 300));
      return res.status(500).json({ error: 'Cover generation failed' });
    }

    // Extract base64 image from inlineData
    const parts = data.candidates[0].content.parts;
    let imageUrl = null;
    for (const part of parts) {
      if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
        imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!imageUrl) {
      return res.status(500).json({ error: 'No image generated' });
    }

    if (writingId) {
      db.prepare('UPDATE writings SET cover_url = ? WHERE id = ? AND user_id = ?')
        .run(imageUrl, parseInt(writingId), userId);
    }

    res.json({ success: true, imageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate cover' });
  }
});
// ─── GAME: WHICH BOOK CHARACTER DO YOU LOOK LIKE? (Groq Llama 4 Scout) ──
app.post('/api/game/character-lookalike', upload.single('photo'), async (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  if (!req.file) return res.status(400).json({ error: 'Photo required' });

  try {
    const imagePath = path.join(__dirname, 'uploads', req.file.filename);
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'system',
            content: `You are a literary character lookalike expert inside BookTok.
Analyze the person's photo and tell them which famous book character they resemble.
Return ONLY a valid JSON object in this exact format:
{
  "character": "Character Name",
  "book": "Book Title",
  "author": "Author Name",
  "description": "A fun, friendly 2-3 sentence explanation of why they look like this character. Be creative and kind!",
  "emoji": "A relevant emoji for the character"
}
Do not include any other text, markdown, or explanations outside the JSON.`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Which book character do I look like?' },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
        ],
        temperature: 0.9,
        max_tokens: 300
      })
    });

    const data = await response.json();
    
    if (!data.choices || !data.choices.length) {
      console.error('Groq game error:', data);
      return res.status(500).json({ error: 'Character matching failed' });
    }

    const rawText = data.choices[0].message.content;
    const jsonStr = rawText.replace(/```json\n?/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(jsonStr);

    res.json({ success: true, result });
  } catch (err) {
    console.error('Game error:', err);
    res.status(500).json({ error: 'Failed to analyze photo' });
  }
});
// ─── CHARACTER CHAT (AI role‑plays as book characters) ──
app.post('/api/character-chat', async (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { character, message } = req.body;
  if (!character || !message || !message.trim()) return res.status(400).json({ error: 'Character and message required' });

  const systemPrompt = `You are ${character} from literature. Stay in character at all times.
Respond to the user's message exactly as ${character} would — using the character's typical speech patterns, 
catchphrases, and personality. Keep responses under 100 words and always refer to the user as "dear reader".
Do NOT break character or mention that you are an AI.`;

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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message.trim() }
        ],
        temperature: 0.9,
        max_tokens: 200
      })
    });

    const data = await response.json();
    if (!data.choices || !data.choices.length) {
      return res.status(500).json({ error: 'Character is unavailable' });
    }

    const reply = data.choices[0].message.content.trim();
    res.json({ reply });
  } catch (err) {
    console.error('Character chat error:', err);
    res.status(500).json({ error: 'Chat failed' });
  }
});
// ─── BOOKTOK AWARDS ────────────────────────────────────
const AWARD_CATEGORIES = [
  { key: 'best_book', label: 'Best Book of the Month', type: 'book' },
  { key: 'best_story', label: 'Best Writo Story', type: 'post' },
  { key: 'best_reviewer', label: 'Most Helpful Reviewer', type: 'user' }
];

app.get('/api/awards/categories', (req, res) => {
  res.json(AWARD_CATEGORIES);
});

// Nominate
app.post('/api/awards/nominate', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { category, nominee_type, nominee_id } = req.body;
  if (!category || !nominee_type || !nominee_id) return res.status(400).json({ error: 'Missing fields' });

  try {
    db.prepare('INSERT INTO award_nominations (user_id, category, nominee_type, nominee_id) VALUES (?, ?, ?, ?)')
      .run(userId, category, nominee_type, parseInt(nominee_id));
    res.json({ success: true });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Already nominated this' });
    res.status(500).json({ error: 'Nomination failed' });
  }
});

// Get nominations with vote counts
app.get('/api/awards/nominations/:category', (req, res) => {
  const category = req.params.category;
  const nominations = db.prepare(`
    SELECT n.*, u.username AS nominator_name,
      (SELECT COUNT(*) FROM award_votes WHERE nomination_id = n.id) AS vote_count
    FROM award_nominations n
    JOIN users u ON n.user_id = u.id
    WHERE n.category = ?
    ORDER BY vote_count DESC
    LIMIT 20
  `).all(category);

  // Fetch nominee details based on type
  const result = nominations.map(n => {
    let nomineeDetails = {};
    if (n.nominee_type === 'book') {
      const book = db.prepare('SELECT title, author FROM books WHERE id = ?').get(n.nominee_id);
      nomineeDetails = { name: book?.title || 'Unknown', subtitle: book?.author || '' };
    } else if (n.nominee_type === 'post') {
      const post = db.prepare('SELECT content FROM posts WHERE id = ?').get(n.nominee_id);
      nomineeDetails = { name: post?.content?.split('\n')[0]?.substring(0, 80) || 'Untitled', subtitle: 'Writo Story' };
    } else if (n.nominee_type === 'user') {
      const user = db.prepare('SELECT username FROM users WHERE id = ?').get(n.nominee_id);
      nomineeDetails = { name: user?.username || 'Unknown', subtitle: 'Reviewer' };
    }
    return { ...n, nomineeDetails };
  });
  res.json(result);
});

// Vote for a nomination
app.post('/api/awards/vote', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const { nominationId } = req.body;
  if (!nominationId) return res.status(400).json({ error: 'Nomination ID required' });

  try {
    db.prepare('INSERT INTO award_votes (user_id, nomination_id) VALUES (?, ?)').run(userId, parseInt(nominationId));
    res.json({ success: true });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Already voted' });
    res.status(500).json({ error: 'Vote failed' });
  }
});

// Declare winners and award badges (admin or scheduled)
app.post('/api/awards/declare-winners', (req, res) => {
  AWARD_CATEGORIES.forEach(cat => {
    const winner = db.prepare(`
      SELECT n.*, COUNT(v.id) AS vote_count
      FROM award_nominations n
      LEFT JOIN award_votes v ON n.id = v.nomination_id
      WHERE n.category = ?
      GROUP BY n.id
      ORDER BY vote_count DESC
      LIMIT 1
    `).get(cat.key);

    if (winner) {
      const badgeName = `Award: ${cat.label}`;
      const badgeIcon = '🏆';
      db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_name, badge_icon) VALUES (?, ?, ?)')
        .run(winner.user_id, badgeName, badgeIcon);
      awardLiCo(winner.user_id, 50, 'award_winner', winner.nominee_id, `Won ${cat.label}`);
    }
  });

  res.json({ success: true, message: 'Winners declared and awarded!' });
});
// ─── BOOK NEWS (NewsAPI – real headlines, book‑focused) ──
let cachedNews = null;
let cacheTime = null;

app.get('/api/book-news', async (req, res) => {
  // Return cached news if less than 1 hour old
  if (cachedNews && cacheTime && (Date.now() - cacheTime) < 3600000) {
    return res.json(cachedNews);
  }

  try {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'News API key not configured' });

    // Targeted book‑specific keywords
    const keywords = [
      '"new book"',
      '"bestselling author"',
      '"literary award" OR "book prize"',
      '"publishing industry"',
      '"book review"',
      'author',
      'novelist'
    ];
    const allArticles = [];

    for (const keyword of keywords) {
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(keyword)}&language=en&sortBy=publishedAt&pageSize=1&apiKey=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.articles) {
        data.articles.forEach(article => {
          // Deduplicate by title prefix
          const shortTitle = article.title?.substring(0, 60);
          if (!allArticles.find(a => a.title?.substring(0, 60) === shortTitle)) {
            allArticles.push(article);
          }
        });
      }
    }

    // Filter to only genuinely book‑related articles
    const bookishWords = ['book', 'author', 'novel', 'writer', 'publish', 'literary', 'bestseller', 'reading', 'poet', 'fiction', 'memoir'];
    const filteredArticles = allArticles.filter(article => {
      const text = ((article.title || '') + ' ' + (article.description || '')).toLowerCase();
      return bookishWords.some(word => text.includes(word));
    });

    // Take the 8 most recent unique articles
    const articles = filteredArticles
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 8)
      .map(article => ({
        title: article.title || 'Untitled',
        summary: article.description || 'No description available.',
        url: article.url || '#',
        source: article.source?.name || 'Unknown Source',
        category: 'News',
        date: new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      }));

    if (!articles.length) {
      return res.json({ success: false, message: 'No book news found right now.' });
    }

    cachedNews = { success: true, articles, generatedAt: new Date().toISOString() };
    cacheTime = Date.now();

    res.json(cachedNews);
  } catch (err) {
    console.error('Book news error:', err);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});
// ─── SHORTS API ───────────────────────────────────────
app.get('/api/shorts', (req, res) => {
  const userId = getCurrentUserId(req);
  const blocked = userId ? getBlockedUserIds(userId) : [];
  
  let query = `SELECT p.id, p.author_id, p.content, p.tags, p.media, p.type, p.created_at, u.username,
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count
    FROM posts p JOIN users u ON p.author_id = u.id
    WHERE p.type = 'short'`;
  
  const params = [];
  if (blocked.length > 0) {
    query += ` AND p.author_id NOT IN (${blocked.map(() => '?').join(',')})`;
    params.push(...blocked);
  }
  query += ' ORDER BY p.created_at DESC LIMIT 50';
  
  let posts = db.prepare(query).all(...params);
  posts.forEach(p => {
    p.media_url = p.media ? `/uploads/${p.media}` : null;
  });
  res.json(posts);
});
// ─── FRIEND CHAT (Socket.io) ──────────────────────────
const io = new Server(server);

const onlineUsers = new Map();

// Create a messages table without foreign key constraints
db.exec(`
  CREATE TABLE IF NOT EXISTS private_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_id INTEGER NOT NULL,
    to_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('user-online', (userId) => {
    onlineUsers.set(userId, socket.id);
    socket.userId = userId;
  });

  socket.on('private-message', ({ to, message }) => {
    const from = socket.userId;
    if (!from) return;
    
    const friendSocket = onlineUsers.get(to);
    
    db.prepare('INSERT INTO private_messages (from_id, to_id, content) VALUES (?, ?, ?)').run(from, to, message);
    
    if (friendSocket) {
      io.to(friendSocket).emit('private-message', {
        from,
        message,
        timestamp: new Date().toISOString()
      });
    }
    
    socket.emit('private-message', {
      from,
      message,
      timestamp: new Date().toISOString(),
      own: true
    });
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
    }
  });
});

// Get chat history with a friend
app.get('/api/chat/:friendId', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const friendId = parseInt(req.params.friendId);
  
  const messages = db.prepare(`
    SELECT * FROM private_messages 
    WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)
    ORDER BY sent_at ASC
    LIMIT 50
  `).all(userId, friendId, friendId, userId);
  
  res.json(messages);
});
// ─── GUESS THE BOOK GAME ──────────────────────────────
const bookPool = [
  { title: "Harry Potter and the Sorcerer's Stone", author: "J.K. Rowling" },
  { title: "The Hobbit", author: "J.R.R. Tolkien" },
  { title: "1984", author: "George Orwell" },
  { title: "The Hunger Games", author: "Suzanne Collins" },
  { title: "Percy Jackson: The Lightning Thief", author: "Rick Riordan" },
  { title: "The Fault in Our Stars", author: "John Green" },
  { title: "Ender's Game", author: "Orson Scott Card" },
  { title: "The Book Thief", author: "Markus Zusak" },
  { title: "Coraline", author: "Neil Gaiman" },
  { title: "The Martian", author: "Andy Weir" },
  { title: "Charlotte's Web", author: "E.B. White" },
  { title: "The Diary of a Young Girl", author: "Anne Frank" },
  { title: "Life of Pi", author: "Yann Martel" },
  { title: "Treasure Island", author: "Robert Louis Stevenson" },
  { title: "The Chronicles of Narnia", author: "C.S. Lewis" },
  { title: "Divergent", author: "Veronica Roth" },
  { title: "The Hitchhiker's Guide to the Galaxy", author: "Douglas Adams" },
  { title: "Matilda", author: "Roald Dahl" },
  { title: "A Wrinkle in Time", author: "Madeleine L'Engle" },
  { title: "Hatchet", author: "Gary Paulsen" }
];

// Store active games in memory
const activeGames = new Map();

app.post('/api/game/guess-book/start', async (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  
  // Pick random book
  const book = bookPool[Math.floor(Math.random() * bookPool.length)];
  
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
          { role: 'system', content: 'You are a game host. Give ONE vague but intriguing hint (max 2 sentences) about a book. Do NOT mention the title or author. Make it fun and mysterious. Start with an emoji.' },
          { role: 'user', content: `Give me the first hint for the book "${book.title}" by ${book.author}.` }
        ],
        temperature: 0.9,
        max_tokens: 80
      })
    });
    const data = await response.json();
    const firstHint = data.choices?.[0]?.message?.content?.trim() || `📚 This book is a beloved classic by ${book.author}.`;
    
    activeGames.set(userId, { book, hintCount: 1, hints: [firstHint] });
    
    res.json({ 
      success: true, 
      firstHint,
      bookTitle: book.title,
      bookAuthor: book.author
    });
  } catch(e) {
    const firstHint = `📚 This book is a well-known work by ${book.author}.`;
    activeGames.set(userId, { book, hintCount: 1, hints: [firstHint] });
    res.json({ success: true, firstHint, bookTitle: book.title, bookAuthor: book.author });
  }
});

app.post('/api/game/guess-book/hint', async (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  
  const { book, author, previousHints } = req.body;
  
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
          { role: 'system', content: 'You are a game host. Give ONE new hint (max 2 sentences) about a book. Make each hint progressively more revealing but still don\'t mention the title or author directly. Start with an emoji.' },
          { role: 'user', content: `Previous hints given: ${previousHints.join(' | ')}\n\nGive the next hint for "${book}" by ${author}.` }
        ],
        temperature: 0.9,
        max_tokens: 80
      })
    });
    const data = await response.json();
    const hint = data.choices?.[0]?.message?.content?.trim() || `📖 Think about books by ${author}...`;
    
    res.json({ hint });
  } catch(e) {
    res.json({ hint: `📖 This book is by ${author}. Think about their most famous works!` });
  }
});

app.post('/api/game/guess-book/guess', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  
  const { guess, bookTitle, bookAuthor, hintsUsed } = req.body;
  
  const guessLower = guess.toLowerCase().trim();
  const titleLower = bookTitle.toLowerCase().trim();
  
  const isCorrect = guessLower === titleLower || 
                    guessLower.includes(titleLower) || 
                    titleLower.includes(guessLower);
  
  let badgeEarned = null;
  
  if (isCorrect) {
    if (hintsUsed <= 3) badgeEarned = "Book Detective 🕵️";
    else if (hintsUsed <= 7) badgeEarned = "Bookworm 📚";
    else badgeEarned = "Page Turner 📖";
    
    // Award badge
    const badgeExists = db.prepare('SELECT * FROM user_badges WHERE user_id = ? AND badge_name = ?').get(userId, badgeEarned);
    if (!badgeExists) {
      db.prepare('INSERT INTO user_badges (user_id, badge_name, badge_icon) VALUES (?, ?, ?)').run(userId, badgeEarned, '🎮');
      awardLiCo(userId, 10, 'guess_book', null, `Won Guess the Book: ${bookTitle}`);
    }
  }
  
  res.json({ correct: isCorrect, badgeEarned: isCorrect ? badgeEarned : null });
});
// ─── BOOK BINGO ──────────────────────────────────────

const bingoChallenges = [
  "📖 Read a fantasy book",
  "🌙 Read before bed",
  "📚 Read 50 pages in one day",
  "🎧 Listen to an audiobook",
  "🏠 Read a book set in your country",
  "🕰️ Read a book published before 2000",
  "🌈 Read a book with a colorful cover",
  "👨‍👩‍👧 Read a book about family",
  "🔍 Read a mystery book",
  "💕 Read a romance book",
  "🚀 Read a sci-fi book",
  "👻 Read a horror book",
  "📝 Write a review",
  "⭐ Rate a book 5 stars",
  "📖 Read outside",
  "🔄 Re-read a favorite book",
  "🎬 Read a book that became a movie",
  "📕 Read a book under 200 pages",
  "📗 Read a book over 400 pages",
  "🧙 Read a book with magic",
  "🐉 Read a book with dragons",
  "🏆 Finish a reading challenge",
  "📱 Read an e-book",
  "📚 Borrow a book from a friend"
];

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function generateBingoCard() {
  const shuffled = [...bingoChallenges].sort(() => Math.random() - 0.5);
  const card = [];
  for (let i = 0; i < 4; i++) {
    card.push(shuffled.slice(i * 4, (i + 1) * 4));
  }
  // Make center a FREE space
  card[1][1] = "⭐ FREE SPACE";
  return card;
}

// Get or create user's bingo card for this week
app.get('/api/bingo/card', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  
  const weekStart = getWeekStart();
  let card = db.prepare('SELECT * FROM bingo_cards WHERE user_id = ? AND week_start = ?').get(userId, weekStart);
  
  if (!card) {
    const cardData = generateBingoCard();
    db.prepare('INSERT INTO bingo_cards (user_id, week_start, card_data) VALUES (?, ?, ?)').run(userId, weekStart, JSON.stringify(cardData));
    card = db.prepare('SELECT * FROM bingo_cards WHERE user_id = ? AND week_start = ?').get(userId, weekStart);
  }
  
  card.card_data = JSON.parse(card.card_data);
  card.completed_squares = JSON.parse(card.completed_squares || '[]');
  
  res.json(card);
});

// Mark a square as complete
app.post('/api/bingo/complete', (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  
  const { row, col } = req.body;
  const weekStart = getWeekStart();
  
  let card = db.prepare('SELECT * FROM bingo_cards WHERE user_id = ? AND week_start = ?').get(userId, weekStart);
  if (!card) return res.status(404).json({ error: 'No bingo card found' });
  
  const completed = JSON.parse(card.completed_squares || '[]');
  const squareKey = `${row}-${col}`;
  
  if (completed.includes(squareKey)) return res.status(400).json({ error: 'Already completed' });
  
  completed.push(squareKey);
  
  // Check for completed rows, columns, diagonals
  const cardData = JSON.parse(card.card_data);
  let newRowCompleted = false;
  
  // Check row
  const rowComplete = [0,1,2,3].every(c => completed.includes(`${row}-${c}`) || cardData[row][c] === "⭐ FREE SPACE");
  if (rowComplete) newRowCompleted = true;
  
  // Check column
  const colComplete = [0,1,2,3].every(r => completed.includes(`${r}-${col}`) || cardData[r][col] === "⭐ FREE SPACE");
  if (colComplete) newRowCompleted = true;
  
  // Check diagonals
  const diag1 = row === col && [0,1,2,3].every(i => completed.includes(`${i}-${i}`) || cardData[i][i] === "⭐ FREE SPACE");
  const diag2 = row + col === 3 && [0,1,2,3].every(i => completed.includes(`${i}-${3-i}`) || cardData[i][3-i] === "⭐ FREE SPACE");
  if (diag1 || diag2) newRowCompleted = true;
  
  let rowsCompleted = card.rows_completed;
  if (newRowCompleted) rowsCompleted++;
  
  // Check full card
  const totalSquares = 16;
  const freeSpace = 1;
  const isFullCard = completed.length >= (totalSquares - freeSpace);
  
  db.prepare('UPDATE bingo_cards SET completed_squares = ?, rows_completed = ?, is_full_card = ? WHERE id = ?')
    .run(JSON.stringify(completed), rowsCompleted, isFullCard ? 1 : 0, card.id);
  
  let badgeEarned = null;
  
  if (newRowCompleted) {
    awardLiCo(userId, 15, 'bingo_row', null, 'Bingo row completed!');
    badgeEarned = "Bingo! 🎯";
    const badgeExists = db.prepare('SELECT * FROM user_badges WHERE user_id = ? AND badge_name = ?').get(userId, badgeEarned);
    if (!badgeExists) {
      db.prepare('INSERT INTO user_badges (user_id, badge_name, badge_icon) VALUES (?, ?, ?)').run(userId, badgeEarned, '🎯');
    }
  }
  
  if (isFullCard) {
    awardLiCo(userId, 50, 'bingo_full', null, 'Full bingo card!');
    badgeEarned = "Bingo Master 🏆";
    const badgeExists = db.prepare('SELECT * FROM user_badges WHERE user_id = ? AND badge_name = ?').get(userId, badgeEarned);
    if (!badgeExists) {
      db.prepare('INSERT INTO user_badges (user_id, badge_name, badge_icon) VALUES (?, ?, ?)').run(userId, badgeEarned, '🏆');
    }
  }
  
  res.json({ 
    success: true, 
    rowCompleted: newRowCompleted,
    isFullCard: !!isFullCard,
    rowsCompleted,
    badgeEarned
  });
});
// ─── START ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`📚 BookTok running at http://localhost:${PORT}`));

