let currentUser = null;
// LiCo coin drop sound (base64 WAV)
const licoCoinSound = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YVoGAACAf39/f3+Af3+Af3+AgH9/gH9/f3+Af3+Af39/gH+Af3+Af3+Af39/gH+Af3+Af39/f3+Af3+AgH9/f3+Af3+Af39/gH+Af3+Af39/gH+Af39/gH+Af3+Af3+Af39/gH+Af39/gH+Af39/gH+Af3+Af39/gH+Af3+Af39/gH+Af3+Af39/gH+Af3+Af39/gH+Af39/gH+Af3+Af39/gH+Af39/gH+Af39/gH+Af3+Af39/gH+Af39/gH+Af39/gH+Af3+Af39/gH+Af39/gH+Af39/gH+Af3+Af39/gH+Af39/gH+Af39/gH+Af3+Af39/gH+Af39/gH+Af39/gH+Af3+Af39/gH+Af39/gH+Af39/gH+Af3+Af39/gH+Af39/gH+Af39/gH+Af39/AAD/+5BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

// Show a flying coin from top-right to the piggy bank
function showLiCoAnimation(amount = 1) {
  const coin = document.createElement('div');
  coin.className = 'flying-coin';
  coin.textContent = '🪙';
  document.body.appendChild(coin);

  // Play sound
  licoCoinSound.currentTime = 0;
  licoCoinSound.play().catch(() => {});

  // Animate the piggy bank
  const piggy = document.getElementById('piggy-bank');
  if (piggy) {
    piggy.classList.add('pop');
    setTimeout(() => piggy.classList.remove('pop'), 300);
  }

  // Remove coin after animation
  setTimeout(() => {
    coin.remove();
  }, 1300);
}
let currentFeed = 'global';

// On page load
window.addEventListener('DOMContentLoaded', async () => {
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark');
  }

  const me = await fetch('/api/me');
  if (me.ok) {
    currentUser = await me.json();
    showMainApp();
    startNotificationPolling();
  } else {
    showAuth();
  }

  // Search bar setup
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      clearTimeout(searchTimeout);
      const term = this.value.trim();
      if (!term) {
        document.getElementById('search-results').style.display = 'none';
        return;
      }
      searchTimeout = setTimeout(() => doSearch(term), 300);
    });
  }
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#search-input') && !e.target.closest('#search-results')) {
      const results = document.getElementById('search-results');
      if (results) results.style.display = 'none';
    }
  });

  // Dark mode toggle
  const darkToggle = document.getElementById('dark-toggle');
  if (darkToggle) {
    darkToggle.addEventListener('click', toggleDarkMode);
    updateDarkModeIcon();
  }
});

let searchTimeout;
async function doSearch(term) {
  const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
  const data = await res.json();
  const container = document.getElementById('search-results');
  if (!container) return;
  container.innerHTML = '';
  if (data.users.length) {
    container.innerHTML += '<div style="padding:5px; font-weight:bold; border-bottom:1px solid #eee;">👤 Users</div>';
    data.users.forEach(u => {
      container.innerHTML += `<a href="profile.html?id=${u.id}" style="display:block; padding:8px; text-decoration:none; color:var(--text);">${escapeHTML(u.username)}</a>`;
    });
  }
  if (data.posts.length) {
    container.innerHTML += '<div style="padding:5px; font-weight:bold; border-bottom:1px solid #eee;">📝 Posts</div>';
    data.posts.forEach(p => {
      container.innerHTML += `<div style="padding:8px; border-bottom:1px solid #eee;"><div style="font-size:0.9em;">${escapeHTML(p.content.substring(0,60))}…</div><a href="profile.html?id=${p.author_id}" style="font-size:0.8em;">${escapeHTML(p.username)}</a></div>`;
    });
  }
  if (data.books.length) {
    container.innerHTML += '<div style="padding:5px; font-weight:bold; border-bottom:1px solid #eee;">📚 Books</div>';
    data.books.forEach(b => {
      container.innerHTML += `<a href="book.html?id=${b.id}" style="display:block; padding:8px; text-decoration:none; color:var(--text);">${escapeHTML(b.title)} by ${escapeHTML(b.author)}</a>`;
    });
  }
  if (!data.users.length && !data.posts.length && !data.books.length) {
    container.innerHTML = '<div style="padding:15px;">No results found.</div>';
  }
  container.style.display = 'block';
}

// Toast notification
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; background: ${type === 'error' ? 'var(--danger)' : 'var(--primary)'};
    color: white; padding: 10px 20px; border-radius: 25px; z-index: 9999;
    font-weight: 600; opacity: 0; transition: opacity 0.3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '1'; }, 10);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Content Warning Filter
const bannedWords = ['badword1', 'badword2'];
function containsBannedWord(text) {
  const lower = text.toLowerCase();
  return bannedWords.some(word => lower.includes(word));
}

// Skeleton Loader
function showSkeleton() {
  const container = document.getElementById('feed-posts');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const div = document.createElement('div');
    div.className = 'post skeleton';
    div.innerHTML = `
      <div style="background:#eee; height:20px; width:30%; margin-bottom:10px; border-radius:4px;"></div>
      <div style="background:#eee; height:14px; width:80%; margin-bottom:8px; border-radius:4px;"></div>
      <div style="background:#eee; height:14px; width:60%; border-radius:4px;"></div>
    `;
    container.appendChild(div);
  }
}

// Auth visibility helpers
function showAuth() {
  const auth = document.getElementById('auth-section');
  const main = document.getElementById('main-section');
  if (auth) auth.style.display = 'block';
  if (main) main.style.display = 'none';
}

function showMainApp() {
  const auth = document.getElementById('auth-section');
  const main = document.getElementById('main-section');
  if (auth) auth.style.display = 'none';
  if (main) main.style.display = 'block';

  // Update user pill (avatar + username)
  const userPill = document.getElementById('user-pill');
  const userPillImg = document.getElementById('user-pill-img');
  const userPillName = document.getElementById('user-pill-name');
  if (userPill && currentUser) {
    userPill.href = `profile.html?id=${currentUser.id}`;
    userPillName.textContent = currentUser.username;

    let avatarUrl = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22%3E%3Ccircle cx=%2216%22 cy=%2216%22 r=%2216%22 fill=%22%23ddd%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2214%22%3E?%3C/text%3E%3C/svg%3E';
    if (currentUser.avatar_seed) {
      const style = currentUser.avatar_style || 'adventurer';
      const seed = encodeURIComponent(currentUser.avatar_seed);
      avatarUrl = `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`;
    } else if (currentUser.profile_pic_url) {
      avatarUrl = currentUser.profile_pic_url;
    }
    userPillImg.src = avatarUrl;
  }

  // Update LiCo balance
  updateLiCoBalance();

  // Load feeds and panels
  if (typeof loadFeed === 'function') loadFeed();
  if (typeof loadRecommendations === 'function') loadRecommendations();
  if (typeof loadFriends === 'function') loadFriends();
  if (typeof loadFriendRequests === 'function') loadFriendRequests();
  if (typeof updateNotificationCount === 'function') updateNotificationCount();
  if (typeof loadDailyPick === 'function') loadDailyPick();
}

function showSignUp() {
  document.getElementById('login-box').style.display = 'none';
  document.getElementById('signup-box').style.display = 'block';
}
function showLogin() {
  document.getElementById('signup-box').style.display = 'none';
  document.getElementById('login-box').style.display = 'block';
}

// AUTH
async function login() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (res.ok) {
    const me = await fetch('/api/me');
    currentUser = await me.json();
    showMainApp();
  } else {
    const data = await res.json();
    showToast(data.error || 'Login failed', 'error');
  }
}
async function signup() {
  const username = document.getElementById('signup-username').value.trim();
  const email = document.getElementById('signup-email')?.value.trim();
  const password = document.getElementById('signup-password').value;
  const birth_year = parseInt(document.getElementById('signup-birthyear').value);
  const genresRaw = document.getElementById('signup-genres').value;
  const favourite_genres = genresRaw.split(',').map(g => g.trim()).filter(g => g);
  
  if (!username || !password || !birth_year) {
    return showToast('Username, password, and birth year are required', 'error');
  }
  
  const res = await fetch('/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password, birth_year, favourite_genres })
  });
  
  if (res.ok) {
    const me = await fetch('/api/me');
    currentUser = await me.json();
    showMainApp();
  } else {
    const data = await res.json();
    showToast(data.error || 'Signup failed', 'error');
  }
}
async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  showAuth();
}

// FEED TABS
function switchFeed(feedType) {
  currentFeed = feedType;
  document.querySelectorAll('.feed-tab').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.feed-tab[onclick="switchFeed('${feedType}')"]`);
  if (activeBtn) activeBtn.classList.add('active');
  const titles = { global: 'Global Feed', foryou: 'For You', friends: 'Friends Feed' };
  const titleEl = document.getElementById('feed-title');
  if (titleEl) titleEl.textContent = titles[feedType] || 'Feed';
  loadFeed();
}

// ─── LiCo FUNCTIONS ──────────────────────────
let lastLiCoBalance = null;

async function updateLiCoBalance() {
  if (!currentUser) return;
  try {
    const res = await fetch('/api/lico/balance');
    if (res.ok) {
      const data = await res.json();
      const el = document.getElementById('lico-amount');
      if (el) {
        // Get previous balance from localStorage
        const storedBalance = localStorage.getItem('lastLiCoBalance');
        const previousBalance = storedBalance !== null ? parseInt(storedBalance) : null;
        const newBalance = data.balance;

        el.textContent = newBalance;

        // If we just earned LiCo (balance increased), show animation
        if (previousBalance !== null && newBalance > previousBalance) {
          const earned = newBalance - previousBalance;
          showLiCoAnimation(earned);
        }

        // Save current balance for next comparison
        localStorage.setItem('lastLiCoBalance', newBalance);
      }
    }
  } catch(e) {}
}
async function tipPost(postId) {
  const amount = parseInt(prompt('Tip how many LiCo? (1‑5)'));
  if (!amount || amount < 1 || amount > 5) return;
  const res = await fetch('/api/lico/tip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postId, amount })
  });
  if (res.ok) {
    showToast('Tip sent!');
    updateLiCoBalance();
    loadFeed(); // refresh tip counts
  } else {
    const data = await res.json();
    alert(data.error || 'Failed to tip');
  }
}

// LOAD FEED
async function loadFeed() {
  showSkeleton();
  let url;
  if (currentFeed === 'global') url = '/api/feed/global';
  else if (currentFeed === 'foryou') url = '/api/feed/for-you';
  else url = '/api/feed';

  const res = await fetch(url);
  const posts = await res.json();
  const container = document.getElementById('feed-posts');
  if (!container) return;
  container.innerHTML = '';

  posts.forEach(post => {
    const div = document.createElement('div');
    div.className = 'post';
    let mediaHTML = '';
    if (post.media_url) {
      const ext = post.media_url.split('.').pop().toLowerCase();
      if (['mp4','webm','ogg'].includes(ext)) {
        mediaHTML = `<video controls style="max-width:100%; margin-top:8px;"><source src="${post.media_url}" type="video/${ext}"></video>`;
      } else {
        mediaHTML = `<img src="${post.media_url}" alt="post media" style="max-width:100%; margin-top:8px;" />`;
      }
    }

    let contentHTML = '';
    if (post.type === 'quote' && post.quote_text) {
      contentHTML = `
        <blockquote style="margin:10px 0; padding:12px 15px; background: #fdf6e3; border-left: 4px solid var(--accent); border-radius:6px; font-style:italic;">
          <p style="font-size:1.1em; margin:0;">“${escapeHTML(post.quote_text)}”</p>
          ${post.quote_author ? `<footer style="margin-top:5px; color:var(--text-light);">— ${escapeHTML(post.quote_author)}${post.quote_book_title ? `, <cite>${escapeHTML(post.quote_book_title)}</cite>` : ''}</footer>` : ''}
        </blockquote>
      `;
      if (post.content) contentHTML += `<div class="content">${escapeHTML(post.content)}</div>`;
    } else {
      contentHTML = `<div class="content">${escapeHTML(post.content)}</div>`;
    }

    const isOwner = currentUser && currentUser.id === post.author_id;
    const menuHTML = isOwner ? `
      <div class="post-menu" style="float:right; position:relative;">
        <span onclick="togglePostMenu(${post.id})" style="cursor:pointer;">⋮</span>
        <div id="post-menu-${post.id}" style="display:none; position:absolute; right:0; background:white; border:1px solid #ddd; border-radius:4px; z-index:10;">
          <button class="edit-post-btn" data-post-id="${post.id}" data-content="${escapeHTML(post.content).replace(/"/g, '&quot;')}" data-tags="${post.tags.join(',')}">✏️ Edit</button>
          <button onclick="deletePost(${post.id})" style="color:red;">🗑 Delete</button>
        </div>
      </div>
    ` : `
      <div style="float:right;">
        <button onclick="reportPost(${post.id}, ${post.author_id})" style="font-size:0.8em; color:var(--danger); background:none; border:none; cursor:pointer;">🚩 Report</button>
      </div>
    `;

    const tagsHTML = post.tags.map(t => `<a href="tags.html?tag=${encodeURIComponent(t)}" style="color:var(--accent); text-decoration:none;">#${escapeHTML(t)}</a>`).join(', ');
    const tipCount = post.tips || 0;

    div.innerHTML = `
      ${menuHTML}
      <div class="author">
        <a href="profile.html?id=${post.author_id}" style="color:#5a3e28; text-decoration:underline;">${escapeHTML(post.username)}</a>
        <span style="font-size:0.8em; color:var(--text-light);"> · ${timeAgo(post.created_at)}</span>
      </div>
      ${contentHTML}
      <div class="tags">${tagsHTML}</div>
      ${mediaHTML}
      <button onclick="toggleLike(${post.id})">${post.liked ? '❤️' : '🤍'} ${post.like_count}</button>
      <button onclick="toggleComments(${post.id})">💬 Comments</button>
      <button onclick="tipPost(${post.id})" style="font-size:0.9em;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f1c40f" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
        <span id="tip-count-${post.id}">${tipCount}</span>
      </button>
      <div class="comments-section" id="comments-${post.id}" style="display:none; margin-top:10px;">
        <div class="comments-list" id="comments-list-${post.id}"></div>
        <div class="comment-form">
          <textarea id="comment-input-${post.id}" rows="2" style="width:100%;" placeholder="Write a comment..."></textarea>
          <button onclick="postComment(${post.id})">Comment</button>
        </div>
      </div>
    `;
    container.appendChild(div);
  });

  document.querySelectorAll('.edit-post-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const postId = btn.dataset.postId;
      const content = btn.dataset.content;
      const tags = btn.dataset.tags;
      showEditForm(postId, content, tags);
    });
  });
}

// REPORT POST
function reportPost(postId, authorId) {
  const reason = prompt('Why are you reporting this post? (optional)');
  fetch('/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reported_user_id: authorId, post_id: postId, reason })
  }).then(res => {
    if (res.ok) showToast('Report submitted. Thank you.');
  });
}

// POST MENU & EDIT/DELETE
function togglePostMenu(postId) {
  const menu = document.getElementById(`post-menu-${postId}`);
  if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function showEditForm(postId, content, tags) {
  const menu = document.getElementById(`post-menu-${postId}`);
  if (menu) menu.style.display = 'none';
  const postDiv = document.querySelector(`.post-menu span[onclick="togglePostMenu(${postId})"]`)?.closest('.post');
  if (!postDiv) return;
  const contentDiv = postDiv.querySelector('.content');
  const tagsDiv = postDiv.querySelector('.tags');
  if (contentDiv) contentDiv.innerHTML = `<textarea id="edit-content-${postId}" style="width:100%;">${escapeHTML(content)}</textarea>`;
  if (tagsDiv) tagsDiv.innerHTML = `<input type="text" id="edit-tags-${postId}" value="${tags}" style="width:100%;" />`;
  const actions = document.createElement('div');
  actions.innerHTML = `<button onclick="saveEdit(${postId})">Save</button> <button onclick="loadFeed()">Cancel</button>`;
  if (contentDiv) contentDiv.appendChild(actions);
}

async function saveEdit(postId) {
  const content = document.getElementById(`edit-content-${postId}`).value;
  const tagsInput = document.getElementById(`edit-tags-${postId}`);
  const tags = tagsInput ? tagsInput.value : '';
  const res = await fetch(`/api/posts/${postId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, tags })
  });
  if (res.ok) loadFeed();
  else alert('Failed to edit post');
}

async function deletePost(postId) {
  if (!confirm('Delete this post?')) return;
  const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
  if (res.ok) loadFeed();
}

// LIKE
async function toggleLike(postId) {
  await fetch('/api/like', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postId })
  });
  loadFeed();
}

// COMMENTS
async function toggleComments(postId) {
  const section = document.getElementById(`comments-${postId}`);
  if (!section) return;
  if (section.style.display === 'none' || section.style.display === '') {
    section.style.display = 'block';
    await loadComments(postId);
  } else {
    section.style.display = 'none';
  }
}

async function loadComments(postId) {
  const res = await fetch(`/api/posts/${postId}/comments`);
  const comments = await res.json();
  const list = document.getElementById(`comments-list-${postId}`);
  if (!list) return;
  list.innerHTML = '';
  const topLevel = comments.filter(c => c.parent_id === null);
  const replies = comments.filter(c => c.parent_id !== null);
  topLevel.forEach(c => list.appendChild(buildCommentHTML(c, postId, replies)));
  const orphanReplies = replies.filter(r => !comments.some(c => c.id === r.parent_id));
  orphanReplies.forEach(r => list.appendChild(buildCommentHTML(r, postId, [])));
}

function buildCommentHTML(comment, postId, allReplies) {
  const div = document.createElement('div');
  div.className = 'comment';
  div.style.marginLeft = comment.parent_id ? '20px' : '0';
  div.innerHTML = `
    <strong>${escapeHTML(comment.username)}</strong>
    <span style="font-size:0.8em; color:#888;">${new Date(comment.created_at).toLocaleString()}</span>
    <p>${escapeHTML(comment.content)}</p>
    <button onclick="showReplyForm(${comment.id}, ${postId})">Reply</button>
    <div id="reply-form-${comment.id}" style="display:none; margin-top:5px;">
      <textarea id="reply-input-${comment.id}" rows="2" style="width:100%;" placeholder="Write a reply..."></textarea>
      <button onclick="postReply(${postId}, ${comment.id})">Reply</button>
    </div>
  `;
  const childReplies = allReplies.filter(r => r.parent_id === comment.id);
  childReplies.forEach(reply => div.appendChild(buildCommentHTML(reply, postId, allReplies)));
  return div;
}

function showReplyForm(commentId, postId) {
  const form = document.getElementById(`reply-form-${commentId}`);
  if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function postComment(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;
  await fetch(`/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });
  input.value = '';
  await loadComments(postId);
}

async function postReply(postId, parentId) {
  const input = document.getElementById(`reply-input-${parentId}`);
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;
  await fetch(`/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, parentId })
  });
  await loadComments(postId);
}

// FRIENDS
async function loadFriends() {
  const res = await fetch('/api/friends');
  const friends = await res.json();
  const container = document.getElementById('friends-list');
  if (container) container.innerHTML = friends.map(f => `<div>👤 <a href="profile.html?id=${f.id}">${escapeHTML(f.username)}</a></div>`).join('');
}

async function loadFriendRequests() {
  const res = await fetch('/api/friend-requests');
  const requests = await res.json();
  const container = document.getElementById('friend-requests');
  if (container) container.innerHTML = requests.map(req => `
    <div>
      ${escapeHTML(req.username)} wants to be friends
      <button onclick="respondToRequest(${req.id}, true)">Accept</button>
      <button onclick="respondToRequest(${req.id}, false)">Decline</button>
    </div>
  `).join('');
}

async function sendFriendRequest() {
  const toUsername = document.getElementById('friend-username')?.value?.trim();
  if (!toUsername) return;
  const res = await fetch('/api/friend-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toUsername })
  });
  const data = await res.json();
  if (res.ok) {
    document.getElementById('friend-username').value = '';
    showToast('Friend request sent!');
  } else {
    showToast(data.error || 'Could not send request', 'error');
  }
}

async function respondToRequest(requestId, accept) {
  await fetch('/api/friend-respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, accept })
  });
  loadFriends();
  loadFriendRequests();
}

// RECOMMENDATIONS
async function loadRecommendations() {
  const res = await fetch('/api/recommendations');
  const books = await res.json();
  const container = document.getElementById('rec-books');
  if (container) container.innerHTML = books.map(book => `
    <div class="book-card">
      <a href="book.html?id=${book.id}" style="color:#5a3e28; text-decoration:none; font-weight:700;">${escapeHTML(book.title)}</a>
      <div style="font-size:0.9em;">by ${escapeHTML(book.author)}</div>
      <div style="font-size:0.8em; color:var(--text-light);">${escapeHTML(book.genre)} (ages ${book.min_age}-${book.max_age})</div>
    </div>
  `).join('');
}

// NOTIFICATIONS
let notificationPollInterval;
function startNotificationPolling() {
  updateNotificationCount();
  notificationPollInterval = setInterval(updateNotificationCount, 10000);
}
async function updateNotificationCount() {
  if (!currentUser) return;
  const res = await fetch('/api/notifications/count');
  const data = await res.json();
  const badge = document.getElementById('notif-count');
  if (badge) {
    badge.textContent = data.count;
    badge.style.display = data.count > 0 ? 'inline' : 'none';
  }
}
async function toggleNotifications() {
  const dropdown = document.getElementById('notif-dropdown');
  if (!dropdown) return;
  if (dropdown.style.display === 'none') {
    const res = await fetch('/api/notifications');
    const notifs = await res.json();
    dropdown.innerHTML = notifs.map(n => {
      let text = '';
      const username = escapeHTML(n.from_username || 'Someone');
      if (n.type === 'like') text = `<a href="profile.html?id=${n.from_user_id}">${username}</a> liked your post.`;
      else if (n.type === 'comment') text = `<a href="profile.html?id=${n.from_user_id}">${username}</a> commented on your post.`;
      else if (n.type === 'reply') text = `<a href="profile.html?id=${n.from_user_id}">${username}</a> replied to your comment.`;
      else if (n.type === 'friend_request') text = `<a href="profile.html?id=${n.from_user_id}">${username}</a> sent a friend request.`;
      else text = `<strong>${username}</strong> interacted with you.`;
      return `<div style="padding:10px; border-bottom:1px solid var(--border); font-size:14px;">
        ${text}
        <div style="font-size:11px; color:var(--text-light);">${new Date(n.created_at).toLocaleString()}</div>
      </div>`;
    }).join('');
    if (notifs.length === 0) dropdown.innerHTML = '<div style="padding:15px; text-align:center; color:var(--text-light);">No new notifications ✨</div>';
    dropdown.style.display = 'block';
    fetch('/api/notifications/read-all', { method: 'POST' }).then(() => updateNotificationCount());
  } else {
    dropdown.style.display = 'none';
  }
}

// BLOCK USER
async function toggleBlockUser(userId) {
  const res = await fetch(`/api/block/${userId}`, { method: 'POST' });
  const data = await res.json();
  if (res.ok) {
    showToast(data.blocked ? 'User blocked' : 'User unblocked');
    location.reload();
  }
}

// DARK MODE
function toggleDarkMode() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('darkMode', isDark);
  updateDarkModeIcon();
}
function updateDarkModeIcon() {
  const moon = document.getElementById('moon-icon');
  const sun = document.getElementById('sun-icon');
  if (!moon || !sun) return;
  if (document.body.classList.contains('dark')) {
    moon.style.display = 'none';
    sun.style.display = 'inline';
  } else {
    moon.style.display = 'inline';
    sun.style.display = 'none';
  }
}

async function loadDailyPick() {
  const res = await fetch('/api/daily-pick');
  const data = await res.json();
  if (data.book) {
    document.getElementById('daily-pick-banner').style.display = 'block';
    document.getElementById('daily-pick-text').textContent = data.book.recommendation;
    document.getElementById('daily-pick-book').innerHTML = `<a href="book.html?id=${data.book.id}" style="color:#3a2c1b; font-weight:bold;">${escapeHTML(data.book.title)}</a> by ${escapeHTML(data.book.author)}`;
  }
}

function openPostModal() {
  document.getElementById('post-modal').style.display = 'flex';
}
function closePostModal() {
  document.getElementById('post-modal').style.display = 'none';
}
async function publishPost() {
  const content = document.getElementById('post-content').value.trim();
  const tags = document.getElementById('post-tags').value;
  const file = document.getElementById('post-media').files[0];

  if (!content) return alert('Write something!');

  const formData = new FormData();
  formData.append('content', content);
  formData.append('tags', tags);
  if (file) formData.append('media', file);

  const res = await fetch('/api/posts', { method: 'POST', body: formData });
  if (res.ok) {
    closePostModal();
    document.getElementById('post-content').value = '';
    document.getElementById('post-tags').value = '';
    document.getElementById('post-media').value = '';
    loadFeed();
  } else {
    alert('Failed to post');
  }
}
// ─── UTILS ──────────────────────────────────
function timeAgo(dateStr) {
  const then = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString();
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}