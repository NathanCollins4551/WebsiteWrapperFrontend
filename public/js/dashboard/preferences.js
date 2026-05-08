/**
 * User Preferences Management
 */

const PREFS_KEY = 'ms_user_prefs';
const defaultPrefs = {
  darkMode: true,
  accentColor: 'gold',
  uiDensity: 'comfortable',
  glowEffects: true,
  notifTone: 'subtle',
  notifVolume: 70,
  autoDismiss: '5',
  criticalOnly: false,
  stopAlerts: false
};

function savePrefs() {
  const getVal = (id, prop = 'value') => {
    const el = document.getElementById(id);
    if (!el) return defaultPrefs[id.replace('pref-', '').replace(/-([a-z])/g, g => g[1].toUpperCase())] || '';
    return prop === 'checked' ? el.checked : el.value;
  };

  const prefs = {
    darkMode: getVal('pref-dark-mode', 'checked'),
    accentColor: getVal('pref-accent-color'),
    uiDensity: getVal('pref-ui-density'),
    glowEffects: getVal('pref-glow', 'checked'),
    notifTone: getVal('pref-tone'),
    notifVolume: parseInt(getVal('pref-volume')) || 70,
    autoDismiss: getVal('pref-dismiss'),
    criticalOnly: getVal('pref-critical-only', 'checked'),
    stopAlerts: getVal('pref-stop-alerts', 'checked')
  };
  
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  applyPrefs(prefs);
}

function loadPrefs() {
  const stored = localStorage.getItem(PREFS_KEY);
  const prefs = stored ? { ...defaultPrefs, ...JSON.parse(stored) } : defaultPrefs;
  
  // Update UI Elements
  const fields = {
    'pref-dark-mode': 'checked',
    'pref-accent-color': 'value',
    'pref-ui-density': 'value',
    'pref-glow': 'checked',
    'pref-tone': 'value',
    'pref-volume': 'value',
    'pref-dismiss': 'value',
    'pref-critical-only': 'checked',
    'pref-stop-alerts': 'checked'
  };

  Object.entries(fields).forEach(([id, prop]) => {
    const el = document.getElementById(id);
    if (el) {
      const prefKey = id.replace('pref-', '').replace(/-([a-z])/g, g => g[1].toUpperCase());
      // Handle special mapping
      let key = prefKey;
      if (key === 'darkMode') key = 'darkMode';
      if (key === 'tone') key = 'notifTone';
      if (key === 'volume') key = 'notifVolume';
      if (key === 'dismiss') key = 'autoDismiss';

      el[prop] = prefs[key];
    }
  });

  applyPrefs(prefs);
}

function applyPrefs(prefs) {
  const b = document.body;
  
  b.classList.toggle('light-mode', !prefs.darkMode);
  
  b.classList.remove('theme-blue', 'theme-green', 'theme-crimson');
  if (prefs.accentColor !== 'gold') b.classList.add(`theme-${prefs.accentColor}`);
  
  b.classList.toggle('density-compact', prefs.uiDensity === 'compact');
  b.classList.toggle('no-glow', !prefs.glowEffects);
}

function testTone() {
  const tone = document.getElementById('pref-tone')?.value || 'subtle';
  const volume = (document.getElementById('pref-volume')?.value || 70) / 100;
  
  if (tone === 'mute' || volume <= 0) return;
  if (!window.AudioContext && !window.webkitAudioContext) return;

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  gain.gain.setValueAtTime(0, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  if (tone === 'subtle') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
  } 
  else if (tone === 'industrial') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, audioCtx.currentTime);
  } 
  else if (tone === 'pulse') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.2);
  }

  osc.start();
  osc.stop(audioCtx.currentTime + 0.6);
}

window.savePrefs = savePrefs;
window.loadPrefs = loadPrefs;
window.testTone = testTone;
