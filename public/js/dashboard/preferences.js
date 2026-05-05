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
  const prefs = {
    darkMode: document.getElementById('pref-dark-mode').checked,
    accentColor: document.getElementById('pref-accent-color').value,
    uiDensity: document.getElementById('pref-ui-density').value,
    glowEffects: document.getElementById('pref-glow').checked,
    notifTone: document.getElementById('pref-tone').value,
    notifVolume: parseInt(document.getElementById('pref-volume').value),
    autoDismiss: document.getElementById('pref-dismiss').value,
    criticalOnly: document.getElementById('pref-critical-only').checked,
    stopAlerts: document.getElementById('pref-stop-alerts').checked
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
  if (window.playAlertSound) window.playAlertSound();
}

window.savePrefs = savePrefs;
window.loadPrefs = loadPrefs;
window.testTone = testTone;
