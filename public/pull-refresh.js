// ── PULL‑TO‑REFRESH (mobile) ──
(function() {
  let startY = 0;
  const feed = document.getElementById('feed-posts');
  if (!feed) return;

  feed.addEventListener('touchstart', (e) => {
    startY = e.touches[0].pageY;
  }, { passive: true });

  feed.addEventListener('touchmove', (e) => {
    const y = e.touches[0].pageY;
    if (y - startY > 80 && feed.scrollTop <= 0) {
      feed.style.opacity = '0.6';
      feed.style.transform = 'translateY(10px)';
    }
  }, { passive: true });

  feed.addEventListener('touchend', (e) => {
    const y = e.changedTouches[0].pageY;
    if (y - startY > 80 && feed.scrollTop <= 0) {
      if (typeof loadFeed === 'function') {
        loadFeed().then(() => {
          feed.style.opacity = '1';
          feed.style.transform = 'translateY(0)';
        });
      }
    } else {
      feed.style.opacity = '1';
      feed.style.transform = 'translateY(0)';
    }
  });
})();