/**
 * Personnel Tracking & Zone Monitoring
 */

let visualizer;
let trackingMode = 'sim';
let cameraEnabled = false;
let simCounts = { zone1: 1, zone2: 2, zone3: 1, zone4: 0 };
let simInterval;
let liveInterval;

function toggleCameraFeed() {
  cameraEnabled = !cameraEnabled;
  const btn = document.getElementById('btn-camera-toggle');
  const img = document.getElementById('cvStream');
  const placeholder = document.getElementById('stream-placeholder');

  if (cameraEnabled) {
    btn.innerText = 'CAMERA: ON';
    btn.classList.replace('ghost', 'primary');
    img.src = '/api/video?t=' + Date.now();
    img.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    btn.innerText = 'CAMERA: OFF';
    btn.classList.replace('primary', 'ghost');
    img.src = '';
    img.style.display = 'none';
    placeholder.style.display = 'flex';
  }
  updateTrackingLayout();
}

function updateTrackingLayout() {
  const leftCol = document.getElementById('tracking-left-col');
  const grid = document.getElementById('zone-grid');
  const camera = document.getElementById('camera-feed-container');
  const map = document.getElementById('tracking-map-container');
  const labels = document.querySelectorAll('.personnel-label');

  if (trackingMode === 'live' && cameraEnabled) {
    leftCol.style.width = 'auto';
    leftCol.style.flex = '40 1 0%';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '1fr 1fr';
    grid.style.flex = 'none';
    camera.style.display = 'flex';
    map.style.flex = '60 1 0%';
    labels.forEach(l => l.style.display = 'none');
  } else {
    leftCol.style.width = '140px';
    leftCol.style.flex = '0 0 140px';
    grid.style.display = 'flex';
    grid.style.flexDirection = 'column';
    grid.style.flex = '1';
    camera.style.display = 'none';
    map.style.flex = '1 1 0%';
    labels.forEach(l => l.style.display = 'block');
  }
  
  if (visualizer) {
    setTimeout(() => visualizer.resize(), 50);
    setTimeout(() => visualizer.resize(), 350);
  }
}

function refreshStream() {
  const img = document.getElementById('cvStream');
  if (cameraEnabled) {
    img.src = '/api/video?t=' + Date.now();
  }
}

function setTrackingMode(mode) {
  if (trackingMode === mode && visualizer) return;
  trackingMode = mode;
  
  const btnLive = document.getElementById('btn-live-mode');
  const btnSim = document.getElementById('btn-sim-mode');
  const btnCam = document.getElementById('btn-camera-toggle');
  const errorOverlay = document.getElementById('live-service-error');

  if (visualizer) visualizer.setMode(mode);

  if (mode === 'live') {
    btnLive.classList.replace('ghost', 'primary');
    btnSim.classList.replace('primary', 'ghost');
    btnCam.style.display = 'block';
    clearInterval(simInterval);
    fetchLiveTrackingData();
    if (liveInterval) clearInterval(liveInterval);
    liveInterval = setInterval(fetchLiveTrackingData, 6000);
  } else {
    btnLive.classList.replace('primary', 'ghost');
    btnSim.classList.replace('ghost', 'primary');
    btnCam.style.display = 'none';
    if (errorOverlay) errorOverlay.style.display = 'none';
    
    if (cameraEnabled) {
       cameraEnabled = false;
       const btn = document.getElementById('btn-camera-toggle');
       btn.innerText = 'CAMERA: OFF';
       btn.classList.replace('primary', 'ghost');
    }
    
    clearInterval(liveInterval);
    startSimulation();
  }
  updateTrackingLayout();
}

async function fetchLiveTrackingData() {
  if (trackingMode !== 'live') return;
  const errorOverlay = document.getElementById('live-service-error');
  
  try {
    const samples = [];
    for (let i = 0; i < 3; i++) {
      try {
        const response = await fetch('/api/tracking-data');
        if (response.ok) {
          const data = await response.json();
          samples.push(data.zone_counts);
        }
      } catch (e) {}
      if (i < 2) await new Promise(r => setTimeout(r, 500));
    }

    if (samples.length === 0) throw new Error('Unreachable');
    if (errorOverlay) errorOverlay.style.display = 'none';

    const resolveCount = (zoneKey) => {
      const values = samples.map(s => s[zoneKey] || 0);
      const freq = {};
      values.forEach(v => freq[v] = (freq[v] || 0) + 1);
      let mostFreq = values[0], maxCount = 0;
      for (const v in freq) {
        if (freq[v] >= maxCount) { maxCount = freq[v]; mostFreq = parseInt(v); }
      }
      return mostFreq;
    };

    const counts = {
      zone1: resolveCount('Zone_TopLeft'),
      zone2: resolveCount('Zone_TopRight'),
      zone3: resolveCount('Zone_BottomLeft'),
      zone4: resolveCount('Zone_BottomRight')
    };
    
    if (visualizer) visualizer.updateCounts(counts);
    updateZoneUI(counts);
  } catch (err) {
    if (errorOverlay) errorOverlay.style.display = 'flex';
  }
}

function initVisualizer() {
  visualizer = new PersonnelVisualizer('personnelCanvas', 'tracking-map-container');
  visualizer.debug = true;
  
  visualizer.onZoneEntry = (zoneId, personId) => {
    if (zoneId === 4 && window.notify) {
      window.notify("Security Alert", `Unauthorized entry in Restricted Zone 4 (Subject: ${personId})`, true);
    }
  };

  if (trackingMode === 'sim') {
    visualizer.updateCounts(simCounts);
    updateZoneUI(simCounts);
    startSimulation();
  } else {
    fetchLiveTrackingData();
    liveInterval = setInterval(fetchLiveTrackingData, 6000);
  }
}

function startSimulation() {
  clearInterval(simInterval);
  simInterval = setInterval(simulatePersonnelMovement, 6000);
}

let lastZone4Entry = 0;
function simulatePersonnelMovement() {
  if (!visualizer || trackingMode !== 'sim') return;
  const now = Date.now();
  const canEnterZone4 = (now - lastZone4Entry) > 30000;
  const mustEnterZone4 = (now - lastZone4Entry) > 45000;

  const numShifts = Math.random() < 0.1 ? 0 : (Math.random() < 0.2 ? 3 : (Math.random() < 0.5 ? 1 : 2));
  
  for(let i=0; i<numShifts; i++) {
    const zones = ['zone1', 'zone2', 'zone3', 'zone4', 'outside'];
    const fromZone = zones[Math.floor(Math.random() * zones.length)];
    let targets = [];
    if (fromZone === 'outside') targets = ['zone2'];
    if (fromZone === 'zone1') targets = ['zone2', 'zone3'];
    if (fromZone === 'zone2') targets = ['zone1', 'zone4', 'outside'];
    if (fromZone === 'zone3') targets = ['zone1', 'zone4'];
    if (fromZone === 'zone4') targets = ['zone2', 'zone3'];

    let toZone = targets[Math.floor(Math.random() * targets.length)];
    if (toZone === 'zone4') {
      if (!canEnterZone4 && !mustEnterZone4) toZone = targets.find(t => t !== 'zone4' && t !== fromZone) || fromZone;
      else lastZone4Entry = now;
    }

    if (fromZone === 'outside') { if (simCounts[toZone] < 4) simCounts[toZone]++; }
    else if (toZone === 'outside') { if (simCounts[fromZone] > 0) simCounts[fromZone]--; }
    else if (simCounts[fromZone] > 0 && simCounts[toZone] < 4) { simCounts[fromZone]--; simCounts[toZone]++; }
  }

  Object.keys(simCounts).forEach(z => { if (simCounts[z] > 4) simCounts[z] = 4; });
  visualizer.updateCounts(simCounts);
  updateZoneUI(simCounts);
}

function updateZoneUI(counts) {
  const zoneBoxes = document.querySelectorAll('#zone-grid .instruction-card');
  if (zoneBoxes.length >= 4) {
    zoneBoxes[0].querySelector('div:nth-child(2)').innerText = counts.zone1;
    zoneBoxes[1].querySelector('div:nth-child(2)').innerText = counts.zone2;
    zoneBoxes[2].querySelector('div:nth-child(2)').innerText = counts.zone3;
    zoneBoxes[3].querySelector('div:nth-child(2)').innerText = counts.zone4;
  }
}

// Global exposure
window.toggleCameraFeed = toggleCameraFeed;
window.setTrackingMode = setTrackingMode;
window.fetchLiveTrackingData = fetchLiveTrackingData;
window.refreshStream = refreshStream;

// Map initialization
const mapImg = document.querySelector('#tracking-map-container img');
if (mapImg) {
  if (mapImg.complete) initVisualizer();
  else mapImg.onload = initVisualizer;
}
