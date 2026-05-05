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
function showHowTo(page) {
  document.querySelectorAll('.sub-nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-tab') === page);
  });

  document.querySelectorAll('.how-to-content').forEach(content => {
    content.classList.remove('active');
  });
  
  const target = document.getElementById(`${page}-content`);
  if (target) target.classList.add('active');
}

window.showHowTo = showHowTo;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  loadUser();
  initNavigation();
  initLogout();
  initUnity();
  
  // Load specialized modules
  if (window.loadPrefs) window.loadPrefs();
  if (window.showCalc) window.showCalc('eoq');
});
