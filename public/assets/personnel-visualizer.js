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
        
        this.onZoneEntry = null;
    }

    setMode(newMode) {
        if (this.mode === newMode) return;

        if (newMode === 'live') {
            // Pause simulation: Save current people and clear view
            this.simPeople = [...this.people];
            this.people = [];
            this.mode = 'live';
            this.isFirstUpdate = true; // Force instant spawn for the first live data batch
        } else {
            // Resume simulation: Restore saved people
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
        let pt, attempts = 0;
        let minX = Math.min(...zone.poly.map(p => p.x)), maxX = Math.max(...zone.poly.map(p => p.x));
        let minY = Math.min(...zone.poly.map(p => p.y)), maxY = Math.max(...zone.poly.map(p => p.y));

        do {
            let rawX = minX + Math.random() * (maxX - minX);
            let rawY = minY + Math.random() * (maxY - minY);
            
            // Outer Bias: use square root of random to favor points further from the hub
            let bias = Math.sqrt(Math.random() * 0.7 + 0.3); // Favor 0.3 to 1.0 range
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
                segments.push({ x: 1700, y: 418, type: 'walk', zone: 2 }); // Walk to corridor waypoint
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
        const person = {
            id: this.nextPersonId++,
            x: instant ? pt.x : this.spawnPoint.x, y: instant ? pt.y : this.spawnPoint.y,
            zone: targetZone, state: instant ? 'idle' : 'moving', isExiting: false,
            path: instant ? [] : this.getComplexRoute('outside', targetZone, pt),
            speed: 7 + Math.random() * 2, wanderSpeed: 0.15 + Math.random() * 0.15,
            pulse: 0, pulseDir: 1, inRestricted: false
        };
        this.people.push(person);
    }

    sendToExit(person) {
        person.path = this.getComplexRoute(person.zone, 'outside', this.spawnPoint);
        person.isExiting = true;
        person.state = 'moving';
        person.speed = 8;
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.debug) this.drawDebugZones();

        for (let i = this.people.length - 1; i >= 0; i--) {
            const p = this.people[i];
            
            // Removal check for exiting personnel
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
                
                if (dist < 10) { // Increased threshold for removal/segment change
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
                if (this.isPointInPoly(poly, { x: nextX, y: nextY })) { p.x = nextX; p.y = nextY; }
                else if (p.state === 'idle') { p.wanderTarget = null; }
            } else { p.x = nextX; p.y = nextY; }

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
