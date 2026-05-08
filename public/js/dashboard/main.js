/**
 * Core Dashboard Logic - Navigation, Auth, and Page Handling
 */

// Auth check
const token = localStorage.getItem('authToken');
if (!token) window.location.href = '/login';

// Load user info
async function loadUser() {
  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` },
      credentials: 'include'
    });
    if (!res.ok) { 
      localStorage.removeItem('authToken'); 
      window.location.href = '/login'; 
      return; 
    }
    const { user } = await res.json();
    document.getElementById('navUsername').textContent = user.username;
  } catch (err) {
    console.error('Failed to load user info');
  }
}

// Page switching
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const pageSections = document.querySelectorAll('.page-section');
  const activePagePill = document.getElementById('activePagePill');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const page = item.getAttribute('data-page');
      if (!page) return;
      e.preventDefault();

      // Update nav items
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      // Update sections
      pageSections.forEach(section => section.classList.remove('active'));
      const targetPage = document.getElementById(`${page}-page`);
      if (targetPage) targetPage.classList.add('active');

      // Update top pill
      activePagePill.textContent = item.textContent.trim();
    });
  });
}

// Logout
function initLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    });
  }
}

// Unity Interaction
function initUnity() {
  const launchBtn = document.getElementById('launchBtn');
  const reloadBtn = document.getElementById('reloadBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const unityIframe = document.getElementById('unityIframe');
  const launchOverlay = document.getElementById('launchOverlay');
  const UNITY_BUILD_URL = '/unity/index.html';

  if (launchBtn) {
    launchBtn.addEventListener('click', () => {
      launchOverlay.classList.add('hidden');
      unityIframe.src = UNITY_BUILD_URL + '?t=' + Date.now();
      unityIframe.classList.add('loaded');
    });
  }

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      const wrap = document.getElementById('unityWrap');
      if (wrap.requestFullscreen) wrap.requestFullscreen();
      else if (wrap.webkitRequestFullscreen) wrap.webkitRequestFullscreen();
    });
  }

  if (reloadBtn) {
    reloadBtn.addEventListener('click', () => {
      unityIframe.classList.remove('loaded');
      unityIframe.src = '';
      launchOverlay.classList.remove('hidden');
    });
  }
}

// How-To Sub-navigation
async function showHowTo(page) {
  document.querySelectorAll('.sub-nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-tab') === page);
  });

  const contentMap = {
    'controls': '/partials/howto/controls.html',
    'convai': '/partials/howto/convai.html',
    'object-tracking-docs': '/partials/howto/inventory.html',
    'human-tracking-docs': '/partials/howto/personnel.html',
    'ai-assistant-docs': '/partials/howto/ai-assistant.html'
  };

  const container = document.getElementById('howto-content-container');
  if (container && contentMap[page]) {
    try {
      const res = await fetch(contentMap[page]);
      if (res.ok) {
        container.innerHTML = await res.text();
      }
    } catch (err) {
      console.error('Failed to load how-to content', err);
    }
  }
}

// Initial content loading
async function loadPartials() {
  // Load AI Welcome
  const aiHistory = document.getElementById('ai-chat-history');
  if (aiHistory) {
    try {
      const res = await fetch('/partials/ai-welcome.html');
      if (res.ok) aiHistory.innerHTML = await res.text();
    } catch (err) { console.error('Failed to load AI welcome', err); }
  }

  // Load Initial How-To
  showHowTo('controls');
}

window.showHowTo = showHowTo;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  loadUser();
  initNavigation();
  initLogout();
  initUnity();
  loadPartials();
  
  // Load specialized modules
  if (window.loadPrefs) window.loadPrefs();
  if (window.showCalc) window.showCalc('eoq');
});
