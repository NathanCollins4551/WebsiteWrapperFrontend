/**
 * PersonnelVisualizer.js
 * COMPLETE REFACTOR: Travel Corridor Strategy.
 * Implements precise zone coordinates and strict corridor-based movement.
 */

class PersonnelVisualizer {
    constructor(canvasId, containerId) {
        this.canvas = document.getElementById(canvasId);
        this.container = document.getElementById(containerId);
        this.ctx = this.canvas.getContext('2d');
        
        this.baseWidth = 2752;
        this.baseHeight = 1536;

        this.debug = false; 
        this.spawnPoint = { x: 2046, y: 419 };
        this.isFirstUpdate = true;
        this.mode = 'sim';
        this.simPeople = [];
        this.people = [];
        this.nextPersonId = 1;
        
        this.onZoneEntry = null;

        // Travel Corridor Points
        this.corridor = {
            38: { x: 1640, y: 418, zone: 2 },
            39: { x: 1019, y: 418, zone: 1 },
            40: { x: 1019, y: 1123, zone: 3 },
            41: { x: 1640, y: 1123, zone: 4 }
        };

        this.hubs = {
            1: { x: 950, y: 500 },
            2: { x: 1700, y: 600 },
            3: { x: 950, y: 1100 },
            4: { x: 1600, y: 1100 }
        };

        this.zones = {
            1: { poly: [{x:610,y:280}, {x:1301,y:280}, {x:1301,y:676}, {x:1154,y:676}, {x:1154,y:747}, {x:610,y:747}], restricted: false },
            2: { poly: [{x:1345,y:280}, {x:1854,y:280}, {x:1854,y:338}, {x:2143,y:338}, {x:2143,y:513}, {x:1812,y:513}, {x:1812,y:748}, {x:1477,y:748}, {x:1477,y:679}, {x:1348,y:679}], restricted: false },
            3: { poly: [{x:610,y:788}, {x:610,y:1080}, {x:696,y:1080}, {x:696,y:1249}, {x:1085,y:1249}, {x:1085,y:1372}, {x:1296,y:1372}, {x:1296,y:1014}, {x:1154,y:1014}, {x:1154,y:788}], restricted: false },
            4: { poly: [{x:1490,y:799}, {x:1810,y:799}, {x:1810,y:1144}, {x:2294,y:1144}, {x:2294,y:1355}, {x:2060,y:1359}, {x:2060,y:1276}, {x:1849,y:1279}, {x:1850,y:1363}, {x:1353,y:1371}, {x:1353,y:1030}, {x:1491,y:1030}], restricted: true }
        };

        this.adj = {
            2: [1, 4, 'outside'],
            1: [2, 3],
            3: [1, 4],
            4: [2, 3],
            'outside': [2]
        };

        window.addEventListener('resize', () => this.resize());
        this.resize();
        
        setTimeout(() => this.resize(), 100);
        setTimeout(() => this.resize(), 1000);

        if (window.IntersectionObserver) {
            const observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) this.resize();
            });
            observer.observe(this.canvas);
        }

        this.animate();
    }

    setMode(newMode) {
        if (this.mode === newMode) return;

        if (newMode === 'live') {
            this.simPeople = [...this.people];
            this.people = [];
            this.mode = 'live';
            this.isFirstUpdate = true;
        } else {
            this.people = [...this.simPeople];
            this.mode = 'sim';
            this.isFirstUpdate = false;
        }
    }

    resize() {
        const img = this.container.querySelector('img');
        if (!img) return;
        const rect = img.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width; this.canvas.height = rect.height;
        this.canvas.style.left = (rect.left - containerRect.left) + 'px';
        this.canvas.style.top = (rect.top - containerRect.top) + 'px';
        this.scale = rect.width / this.baseWidth;
    }

    isPointInPoly(poly, pt) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y;
            const xj = poly[j].x, yj = poly[j].y;
            const intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    getRandomPointInZone(zoneId) {
        const zone = this.zones[zoneId];
        const hub = this.hubs[zoneId];
        if (!zone || !hub) return { x: 0, y: 0 };

        let pt, attempts = 0;
        let minX = Math.min(...zone.poly.map(p => p.x)), maxX = Math.max(...zone.poly.map(p => p.x));
        let minY = Math.min(...zone.poly.map(p => p.y)), maxY = Math.max(...zone.poly.map(p => p.y));

        do {
            let rawX = minX + Math.random() * (maxX - minX);
            let rawY = minY + Math.random() * (maxY - minY);
            let bias = Math.sqrt(Math.random() * 0.7 + 0.3);
            pt = { 
                x: hub.x + (rawX - hub.x) * bias, 
                y: hub.y + (rawY - hub.y) * bias 
            };
            attempts++;
        } while (!this.isPointInPoly(zone.poly, pt) && attempts < 100);
        return attempts >= 100 ? { ...hub } : pt;
    }

    updateCounts(newCounts) {
        const currentCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
        this.people.forEach(p => { if (!p.isExiting) currentCounts[p.zone]++; });

        for (let z = 1; z <= 4; z++) {
            let diff = (newCounts[`zone${z}`] || 0) - currentCounts[z];
            if (diff > 0) {
                while (diff > 0) { this.spawnPerson(z, this.isFirstUpdate); diff--; }
            } else if (diff < 0) {
                while (diff < 0) {
                    const person = this.people.find(p => p.zone === z && !p.isExiting);
                    if (person) this.sendToExit(person);
                    diff++;
                }
            }
        }
        this.isFirstUpdate = false;
    }

    findShortestPath(from, to) {
        const queue = [[from]];
        const visited = new Set([from]);
        while (queue.length > 0) {
            const path = queue.shift();
            const node = path[path.length - 1];
            if (node == to) return path;
            for (const neighbor of this.adj[node]) {
                if (!visited.has(neighbor)) { visited.add(neighbor); queue.push([...path, neighbor]); }
            }
        }
        return [from, to];
    }

    getComplexRoute(from, to, endPt) {
        const sequence = this.findShortestPath(from, to);
        const segments = [];
        for (let i = 0; i < sequence.length - 1; i++) {
            const curr = sequence[i];
            const next = sequence[i+1];
            if (curr === 'outside' && next === 2) {
                segments.push({ x: this.spawnPoint.x, y: this.spawnPoint.y, type: 'transition' });
                segments.push({ x: 1700, y: 418, type: 'walk', zone: 2 });
            } else if (curr === 2 && next === 'outside') {
                segments.push({ x: this.corridor[38].x, y: this.corridor[38].y, type: 'walk', zone: 2 });
                segments.push({ x: this.spawnPoint.x, y: this.spawnPoint.y, type: 'transition' });
            } else {
                const pA = Object.values(this.corridor).find(p => p.zone == curr);
                const pB = Object.values(this.corridor).find(p => p.zone == next);
                if (pA) segments.push({ x: pA.x, y: pA.y, type: 'walk', zone: curr });
                if (pB) segments.push({ x: pB.x, y: pB.y, type: 'transition' });
            }
        }
        if (to !== 'outside') segments.push({ x: endPt.x, y: endPt.y, type: 'walk', zone: to });
        return segments;
    }

    spawnPerson(targetZone, instant = false) {
        const pt = this.getRandomPointInZone(targetZone);
        
        // DIFFERENTIATION: Live mode uses simple direct paths, Sim mode uses complex travel corridors
        let path = [];
        if (!instant) {
            if (this.mode === 'live') {
                // Direct "long" move allowed in live mode
                path = [{ x: pt.x, y: pt.y, type: 'walk', zone: targetZone }];
            } else {
                // Standard corridor routing for simulation
                path = this.getComplexRoute('outside', targetZone, pt);
            }
        }

        const person = {
            id: this.nextPersonId++,
            x: instant ? pt.x : this.spawnPoint.x, y: instant ? pt.y : this.spawnPoint.y,
            zone: targetZone, state: instant ? 'idle' : 'moving', isExiting: false,
            path: path,
            speed: 7 + Math.random() * 2, wanderSpeed: 0.15 + Math.random() * 0.15,
            pulse: 0, pulseDir: 1, inRestricted: false
        };
        this.people.push(person);
    }

    sendToExit(person) {
        // DIFFERENTIATION: Live mode uses direct path to exit
        if (this.mode === 'live') {
            person.path = [{ x: this.spawnPoint.x, y: this.spawnPoint.y, type: 'walk', zone: person.zone }];
        } else {
            person.path = this.getComplexRoute(person.zone, 'outside', this.spawnPoint);
        }
        person.isExiting = true;
        person.state = 'moving';
        person.speed = 8;
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.debug) this.drawDebugZones();

        for (let i = this.people.length - 1; i >= 0; i--) {
            const p = this.people[i];
            if (p.isExiting && p.path.length === 0) {
                this.people.splice(i, 1);
                continue;
            }

            p.inRestricted = this.isPointInPoly(this.zones[4].poly, { x: p.x, y: p.y });
            if (p.inRestricted && !p.wasInRestricted) {
                if (this.onZoneEntry) this.onZoneEntry(4, p.id);
            }
            p.wasInRestricted = p.inRestricted;

            p.pulse += 0.05 * p.pulseDir;
            if (p.pulse > 1 || p.pulse < 0) p.pulseDir *= -1;

            let dx = 0, dy = 0, seg = null;
            if (p.state === 'moving' && p.path.length > 0) {
                seg = p.path[0];
                const tdx = seg.x - p.x, tdy = seg.y - p.y;
                const dist = Math.sqrt(tdx * tdx + tdy * tdy);
                if (dist < 10) {
                    p.path.shift();
                    if (p.path.length === 0) {
                        if (p.isExiting) { this.people.splice(i, 1); continue; }
                        else p.state = 'idle';
                    }
                } else {
                    dx = (tdx / dist) * p.speed;
                    dy = (tdy / dist) * p.speed;
                }
            } else if (p.state === 'idle') {
                if (!p.wanderTarget || Math.random() < 0.01) p.wanderTarget = this.getRandomPointInZone(p.zone);
                const wdx = p.wanderTarget.x - p.x, wdy = p.wanderTarget.y - p.y;
                const dist = Math.sqrt(wdx * wdx + wdy * wdy);
                if (dist > 2) {
                    dx = (wdx / dist) * p.wanderSpeed;
                    dy = (wdy / dist) * p.wanderSpeed;
                    seg = { type: 'walk', zone: p.zone };
                }
            }

            const nextX = p.x + dx, nextY = p.y + dy;
            if (seg && seg.type === 'walk') {
                const poly = this.zones[seg.zone].poly;
                // STUCK PREVENTION: Allow movement if in 'moving' state (following a path) 
                // or if the next step is inside the polygon (wandering)
                if (p.state === 'moving' || this.isPointInPoly(poly, { x: nextX, y: nextY })) { 
                    p.x = nextX; p.y = nextY; 
                }
                else if (p.state === 'idle') { 
                    p.wanderTarget = null; 
                }
                
                // Backup recovery: If they are moving but haven't changed position in a long time, force next segment
                if (p.state === 'moving') {
                    p.stuckFrames = (p.stuckFrames || 0) + 1;
                    if (p.stuckFrames > 100) {
                        p.x = seg.x; p.y = seg.y; // Teleport to target
                        p.stuckFrames = 0;
                    }
                } else {
                    p.stuckFrames = 0;
                }
            } else { 
                p.x = nextX; p.y = nextY; 
                p.stuckFrames = 0;
            }

            this.drawPerson(p);
        }
        requestAnimationFrame(() => this.animate());
    }

    drawDebugZones() {
        Object.keys(this.zones).forEach(id => {
            const z = this.zones[id];
            this.ctx.beginPath();
            z.poly.forEach((p, i) => {
                if (i === 0) this.ctx.moveTo(p.x * this.scale, p.y * this.scale);
                else this.ctx.lineTo(p.x * this.scale, p.y * this.scale);
            });
            this.ctx.closePath();
            this.ctx.strokeStyle = z.restricted ? 'rgba(255,0,0,0.5)' : 'rgba(240,180,41,0.5)';
            this.ctx.stroke();
            this.ctx.fillStyle = z.restricted ? 'rgba(255,0,0,0.1)' : 'rgba(240,180,41,0.1)';
            this.ctx.fill();
        });
    }

    drawPerson(p) {
        const s = this.scale, x = p.x * s, y = p.y * s, size = 18 * s;
        const color = p.inRestricted ? `rgba(248, 113, 113, ${0.4 + p.pulse * 0.4})` : 'rgba(240, 180, 41, 0.4)';
        const grad = this.ctx.createRadialGradient(x, y, 0, x, y, size * 1.5);
        grad.addColorStop(0, color); grad.addColorStop(1, 'rgba(0,0,0,0)');
        this.ctx.beginPath(); this.ctx.arc(x, y, size * 1.5, 0, Math.PI * 2);
        this.ctx.fillStyle = grad; this.ctx.fill();
        this.ctx.beginPath(); this.ctx.arc(x, y, size * 0.7, 0, Math.PI * 2);
        this.ctx.fillStyle = p.inRestricted ? '#f87171' : '#F0B429';
        this.ctx.fill();
        this.ctx.beginPath(); this.ctx.arc(x, y - (size * 0.1), size * 0.3, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
        this.ctx.fill();
    }
}
window.PersonnelVisualizer = PersonnelVisualizer;
