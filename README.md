# 📚 BookTok

> *A full-stack social media platform for bookworms — built from scratch by a 13-year-old.*

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white)

---

## ✨ What is BookTok?

BookTok is a complete social platform where readers connect, share reviews, write stories with AI, compete in reading challenges, play book-themed games, and discover their next favorite book — all in one place.

---

## 🚀 Features

### 📱 Social
- **Feed** — Global, Friends, and AI-powered "For You"
- **Posts** — Text, quotes, images, and video uploads
- **Shorts** — TikTok-style vertical video feed
- **Comments** — Nested replies with real-time updates
- **Likes & Tips** — Appreciate posts with ❤️ or LiCo coins
- **Stories** — Instagram-style status updates (24hr expiry)

### 💬 Communication
- **Real-time Chat** — Private messaging with Socket.io, message timestamps, and profile pictures
- **Notifications** — Live alerts for likes, comments, and friend requests
- **Friend System** — Send requests, accept, block, and report users

### 🤖 AI-Powered
- **Libby AI Chat** — Talk to your personal librarian (Groq-powered)
- **Writo Studio** — Write stories with an AI co-writer and cover generator
- **Character Chat** — Chat with 40+ literary characters (Sherlock, Gandalf, etc.)
- **Character Lookalike** — Upload a photo, find your book character twin
- **BookMate** — AI reading soulmate finder
- **Cover Generator** — AI-generated book covers (Gemini)

### 📖 Reading
- **Books Library** — Browse, preview, and read full texts
- **Reading Timer** — Track your reading sessions
- **Reading List** — Want to Read / Currently Reading / Finished
- **Reviews & Ratings** — Write reviews, rate books 1-5 stars
- **Google Books API** — Discover millions of books

### 🎮 Games
- **Guess the Book** — AI gives cryptic hints, you guess the title in 15 tries. Win badges and confetti!
- **Character Lookalike** — Upload a selfie, find your literary twin

### 🏆 Gamification
- **Challenges** — 30+ reading challenges with badges
- **Badges** — Earn achievements for reading, reviewing, posting, and winning games
- **LiCo Economy** — Virtual currency for tipping, upgrades, and premium features
- **Reader Clusters** — Discover your reading personality
- **BookTok Awards** — Nominate and vote for community favorites
- **Streaks** — Daily writing goals with streak tracking

### 🎨 Customization
- **Avatar Builder** — DiceBear integration for custom avatars
- **Dark Mode** — Full dark mode with CSS variables
- **Profile Editing** — Bio, username, password, profile picture

### 📊 Analytics
- **Your Dashboard** — Stats on posts, likes, reading habits
- **Reading Charts** — Monthly book completion graphs (Chart.js)
- **Genre Radar** — See your reading preferences visualized
- **Premium Insights** — Advanced analytics (unlockable)

### 🎭 Fun
- **Splash Screen** — Animated book logo intro
- **Daily Book Pick** — Libby's AI-curated daily recommendation
- **Book News** — Latest publishing news via NewsAPI
- **Discover Page** — Search the entire Google Books catalog

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js, Express.js |
| **Database** | SQLite (better-sqlite3) |
| **Real-time** | Socket.io |
| **Auth** | Passport.js (Local + Google OAuth 2.0) |
| **AI** | Groq (Llama 3.1, Llama 4 Scout), Google Gemini |
| **File Uploads** | Multer |
| **Charts** | Chart.js |
| **APIs** | Google Books, NewsAPI, DiceBear Avatars |
| **Frontend** | Vanilla HTML, CSS, JavaScript (No frameworks!) |

---

## 🏗️ Project Structure
```
BookTok/
├── server.js # Main backend (1 file, 2500+ lines)
├── database/
│ └── setup.js # SQLite schema & seed data
├── public/
│ ├── index.html # Main feed
│ ├── chat.html # Real-time messaging
│ ├── writo.html # AI writing studio
│ ├── shorts.html # Video shorts feed
│ ├── profile.html # User profiles
│ ├── book.html # Book details
│ ├── guess-book.html # AI guessing game
│ └── ...20+ more files
└── package.json
```

---

## 🚀 Run Locally

```bash
# Clone the repo
git clone https://github.com/Aditya-cyber-hind/BookTok.git

# Install dependencies
cd BookTok
npm install

# Create .env file with your API keys
# (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET, GROQ_API_KEY, etc.)

# Start the server
node server.js

# Open http://localhost:3000
---

## 🧠 Built By

**Aditya Choudhary** — 13 years old, 8th grader from India 🇮🇳

This project was built for a hackathon. Every line of code was written from scratch — no templates, no website builders, no AI-generated boilerplate.

---

## 📜 License

MIT © 2026 Aditya Choudhary

---

*"Where stories come alive."* 📚✨