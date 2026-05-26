// ── STORY VIEWER ──
function openStoryViewer(statuses) {
  if (!statuses || !statuses.length) return;

  let current = 0;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.9); z-index:999; display:flex; flex-direction:column; justify-content:center; align-items:center;';
  
  const progressContainer = document.createElement('div');
  progressContainer.style.cssText = 'display:flex; gap:4px; position:absolute; top:20px; left:20px; right:20px;';
  statuses.forEach((_, i) => {
    const bar = document.createElement('div');
    bar.style.cssText = `flex:1; height:3px; background:rgba(255,255,255,0.3); border-radius:2px;`;
    if (i === 0) bar.style.background = 'white';
    bar.id = `progress-bar-${i}`;
    progressContainer.appendChild(bar);
  });
  overlay.appendChild(progressContainer);

  const content = document.createElement('div');
  content.style.cssText = 'color:white; font-size:1.3em; text-align:center; padding:40px; max-width:400px;';
  content.textContent = statuses[current].content || '📷 Photo';
  overlay.appendChild(content);

  const close = document.createElement('button');
  close.textContent = '✕';
  close.style.cssText = 'position:absolute; top:50px; right:20px; background:transparent; border:none; color:white; font-size:1.5em; cursor:pointer;';
  close.onclick = () => overlay.remove();
  overlay.appendChild(close);

  document.body.appendChild(overlay);

  // Auto‑advance every 5 seconds
  const interval = setInterval(() => {
    current++;
    if (current >= statuses.length) {
      clearInterval(interval);
      overlay.remove();
      return;
    }
    content.textContent = statuses[current].content || '📷 Photo';
    statuses.forEach((_, i) => {
      document.getElementById(`progress-bar-${i}`).style.background = i <= current ? 'white' : 'rgba(255,255,255,0.3)';
    });
  }, 5000);
}