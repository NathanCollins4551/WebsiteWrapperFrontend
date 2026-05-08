/**
 * Notification System & Audio Alerts
 */
let audioCtx = null;

function playAlertSound() {
  const prefs = JSON.parse(localStorage.getItem('ms_user_prefs') || '{}');
  if (prefs.stopAlerts) return;
  const tone = prefs.notifTone || 'subtle';
  const volume = (prefs.notifVolume || 70) / 100;
  
  if (tone === 'mute' || volume <= 0) return;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

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

function notify(title, message, isCritical = false) {
  const prefs = JSON.parse(localStorage.getItem('ms_user_prefs') || '{}');
  if (prefs.stopAlerts) return;
  
  const container = document.getElementById('notification-container');
  if (prefs.criticalOnly && !isCritical) return;

  playAlertSound();

  const dismissPref = prefs.autoDismiss || '5';
  const isManual = dismissPref === 'manual';

  const div = document.createElement('div');
  div.className = `notification ${isCritical ? 'critical' : ''}`;
  div.innerHTML = `
    <div class="notification-icon" style="margin-top: 2px;">
      ${isCritical ? 
        '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="width:18px;height:18px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' :
        '<svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" style="width:18px;height:18px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
      }
    </div>
    <div class="notification-content" style="flex: 1;">
      <h6>${title}</h6>
      <p>${message}</p>
      <button class="btn-sm ghost" style="margin-top: 8px; padding: 2px 8px; font-size: 9px; width: 100%; border-color: var(--border);">Dismiss</button>
    </div>
  `;

  container.appendChild(div);

  if (!isManual) {
    setTimeout(() => {
      if (div.parentNode) {
        div.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => div.remove(), 300);
      }
    }, parseInt(dismissPref) * 1000);
  }
  
  div.onclick = () => {
    div.style.animation = 'fadeOut 0.3s forwards';
    setTimeout(() => div.remove(), 300);
  };
}

// Global exposure for testing from preferences
window.playAlertSound = playAlertSound;
window.notify = notify;
