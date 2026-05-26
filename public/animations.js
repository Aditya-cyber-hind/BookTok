// ── GLOBAL ANIMATION HELPERS ──

// Toast system
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Page transition – call on every page load
function pageEnter() {
  document.querySelector('.container')?.classList.add('page-enter');
}

// Skeleton loader – returns HTML for skeleton cards
function skeletonCard() {
  return `<div class="skeleton" style="height:120px; margin-bottom:12px;"></div>`;
}

// Heart pop animation
function animateHeart(el) {
  el.classList.add('heart-pop');
  setTimeout(() => el.classList.remove('heart-pop'), 400);
}

// Auto‑run page transition on load
document.addEventListener('DOMContentLoaded', pageEnter);