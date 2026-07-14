# 📚 BookTok

> *A full-stack social media platform for bookworms — built from scratch by a 13-year-old.*

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white)

---

## ✨ What is BookTok?

BookTok is a complete social platform where readers connect, share reviews, write stories with AI, compete in reading challenges, play book-themed games, chat in genre communities, and discover their next favorite book — all in one place.

---

## 🚀 Features

### 📱 Social
- **Feed** — Global, Friends, and AI-powered "For You" with smart 5-signal algorithm
- **Posts** — Text, quotes, images, and video uploads
- **Shorts** — TikTok-style vertical video feed with auto-play, pause animation, and arrow key navigation
- **Comments** — Nested replies with real-time updates
- **Likes & Tips** — Appreciate posts with ❤️ or LiCo coins
- **Stories** — Instagram-style status updates (24hr expiry)

### 💬 Communication
- **Private Chat** — Real-time messaging with Socket.io, timestamps, and profile pictures
- **Book Communities** — Genre-based group chat rooms (Fantasy, Sci-Fi, Romance, Mystery, Horror, Classics, General)
- **Notifications** — Live alerts for likes, comments, friend requests, and tips
- **Friend System** — Send requests, accept, block, and report users

### 🤖 AI-Powered
- **Libby AI Chat** — Talk to your personal librarian with upgradeable AI (Groq Llama 3.1)
- **Writo Studio** — Write stories with an AI co-writer, rich text editor, and cover generator
- **Character Chat** — Chat with 40+ literary characters with voice call support (speech recognition + TTS)
- **Character Lookalike** — Upload a photo, find your book character twin (Llama 4 Scout vision)
- **BookMate** — AI reading soulmate finder based on shared books and genres
- **Cover Generator** — AI-generated book covers (Google Gemini)

### 📖 Reading
- **Books Library** — Browse 40+ books with Open Library and Google Books previews
- **Reading Timer** — Track reading sessions with start/pause/stop
- **Reading List** — Want to Read / Currently Reading / Finished with progress tracking
- **Reviews & Ratings** — Write reviews, rate books 1-5 stars
- **Google Books API** — Discover millions of books worldwide
- **Project Gutenberg** — 10 classic books with full readable text

### 🎮 Games
- **Guess the Book** — AI gives cryptic hints, guess the title in 15 tries with confetti celebration
- **Book Bingo** — Weekly 4x4 bingo cards with reading challenges and badge rewards
- **Book Trivia** — AI generates quiz questions from your reading history
- **Book Scramble** — Unscramble jumbled book titles with streak tracking
- **Character Lookalike** — Upload a selfie, find your literary twin

### 🎵 Vibe Zone
- **Personal Mix** — Music playlists matching your reading mood via YouTube Music
- **Trending Tracks** — Hot songs curated for the BookTok community
- **Embedded Player** — Listen while you browse with now-playing display

### 🏆 Gamification
- **Challenges** — 30+ reading challenges with progress tracking
- **Badges** — Earn achievements for reading, reviewing, posting, games, and bingo
- **LiCo Economy** — Virtual currency for tipping, golden badge, Libby upgrade, premium dashboard
- **Reader Clusters** — Discover your reading personality (Fantasy Fanatic, Sci-Fi Explorer, etc.)
- **BookTok Awards** — Community nominations and voting for best books, stories, and reviewers
- **Streaks** — Daily writing goals with streak tracking

### 🎨 Customization
- **Avatar Builder** — DiceBear integration with multiple styles
- **Dark Mode** — Full dark mode with CSS variables
- **Profile Editing** — Bio, username, password, profile picture
- **Private Profile** — Toggle profile visibility

### 📊 Analytics
- **Your Dashboard** — Stats on posts, likes, reading habits, and reading time
- **Reading Charts** — Monthly book completion graphs (Chart.js)
- **Genre Radar** — Visualize your reading preferences
- **Premium Insights** — Advanced analytics unlockable with LiCo

### 🎭 Fun
- **Splash Screen** — Animated book logo intro
- **Daily Book Pick** — Libby's AI-curated daily recommendation
- **Book News** — Latest publishing news via NewsAPI
- **Discover Page** — Search the entire Google Books catalog
- **Trending** — Most liked posts, popular books, top reviewers, trending tags

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js, Express.js |
| **Database** | SQLite (better-sqlite3) |
| **Real-time** | Socket.io (private chat + community chat) |
| **Auth** | Passport.js (Local + Google OAuth 2.0) |
| **AI** | Groq (Llama 3.1, Llama 4 Scout), Google Gemini |
| **Speech** | Web Speech API (SpeechRecognition + SpeechSynthesis) |
| **Music** | YouTube Data API v3 |
| **File Uploads** | Multer |
| **Charts** | Chart.js |
| **APIs** | Google Books, Open Library, Project Gutenberg, NewsAPI, DiceBear Avatars |
| **Frontend** | Vanilla HTML, CSS, JavaScript (No frameworks!) |

---

## 🏗️ Project Structure

```
BookTok/
├── server.js              # Main backend (3000+ lines)
├── database/
│   └── setup.js           # SQLite schema & seed data
├── public/
│   ├── index.html         # Main feed with tabs
│   ├── chat.html          # Private real-time messaging
│   ├── community.html     # Genre community group chat
│   ├── writo.html         # AI writing studio
│   ├── shorts.html        # Video shorts feed (YouTube-style UI)
│   ├── profile.html       # User profiles with status
│   ├── book.html          # Book details with timer & reviews
│   ├── books.html         # Browse library
│   ├── read.html          # Full-text reader with TTS
│   ├── preview.html       # Book preview
│   ├── guess-book.html    # AI book guessing game
│   ├── bingo.html         # Weekly Book Bingo
│   ├── trivia.html        # Book Trivia quiz
│   ├── scramble.html      # Book Scramble game
│   ├── vibe.html          # Vibe Zone music player
│   ├── ai-chat.html       # Libby AI librarian
│   ├── character-chat.html # Chat with 40+ characters + voice calls
│   ├── bookmate.html      # Reading soulmate finder
│   ├── challenges.html    # Reading challenges
│   ├── awards.html        # BookTok Awards
│   ├── activities.html    # All games & activities hub
│   ├── your_info.html     # Analytics dashboard
│   ├── because.html       # Personalized recommendations
│   ├── trending.html      # Trending content
│   ├── discover.html      # Google Books search
│   ├── book-news.html     # Publishing news
│   ├── stories.html       # Community stories
│   ├── tags.html          # Tag-based discovery
│   ├── game-character.html # Character lookalike
│   ├── avatar.html        # Avatar builder
│   ├── splash.html        # Animated splash screen
│   ├── style.css          # Main stylesheet
│   ├── app.js             # Main app logic
│   └── ...                # CSS & JS utilities
└── package.json
```

---

## 🚀 Run Locally

```bash
git clone https://github.com/Aditya-cyber-hind/BookTok.git
cd BookTok
npm install
node server.js
# Open http://localhost:3000
```

---

## 🧠 Built By

**Aditya Choudhary** — 13 years old, 8th grader from India 🇮🇳

This project was built for a hackathon. Every line of code was written from scratch — no templates, no website builders, no AI-generated boilerplate. 45+ features, 35+ pages, 3000+ lines of backend code, all vanilla JavaScript.

---

## 📜 License

MIT © 2026 Aditya Choudhary

---

*"Where stories come alive."* 📚✨