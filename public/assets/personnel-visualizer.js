/**
 * PersonnelVisualizer.js
 * High-performance Canvas Personnel Visualizer for MakerSpace Digital Twin.
 * Handles ripple movement, strict safe-zone pathfinding, and idle wandering.
 */

class PersonnelVisualizer {
    constructor(canvasId, containerId) {
        this.canvas = document.getElementById(canvasId);
        this.container = document.getElementById(containerId);
        this.ctx = this.canvas.getContext('2d');
        
        // Logical resolution
        this.baseWidth = 2752;
        this.baseHeight = 1536;

        this.debug = false; 
        this.entryExit = { x: 2098, y: 411 };
        
        this.zones = {
            1: { poly: [{x:610,y:284}, {x:1305,y:278}, {x:1306,y:674}, {x:1152,y:675}, {x:1151,y:743}, {x:615,y:740}], restricted: false },
            2: { poly: [{x:1347,y:281}, {x:1844,y:284}, {x:1852,y:343}, {x:2133,y:350}, {x:2147,y:507}, {x:1816,y:508}, {x:1805,y:749}, {x:1479,y:750}, {x:1478,y:677}, {x:1353,y:677}], restricted: false },
            3: { poly: [{x:634,y:783}, {x:631,y:1070}, {x:718,y:1074}, {x:725,y:1261}, {x:1082,y:1248}, {x:1092,y:1382}, {x:1306,y:1381}, {x:1299,y:1015}, {x:1152,y:1020}, {x:1143,y:789}], restricted: false },
            4: { poly: [{x:1491,y:798}, {x:1828,y:802}, {x:1829,y:1146}, {x:2276,y:1138}, {x:2284,y:1346}, {x:2075,y:1345}, {x:2069,y:1256}, {x:1839,y:1261}, {x:1836,y:1355}, {x:1367,y:1361}, {x:1361,y:1041}, {x:1517,y:1043}], restricted: true }
        };

        // Transition Gates: Each gate has a Z1 side and a Z2 side coordinate
        this.gates = {
            "1-2": { z1: {x:1264,y:476}, z2: {x:1375,y:476} },
            "1-3": { z1: {x:875,y:723}, z3: {x:875,y:829} },
            "3-4": { z3: {x:1276,y:1135}, z4: {x:1395,y:1135} },
            "4-2": { z4: {x:1671,y:820}, z2: {x:1671,y:723} }
        };

        // Graph of adjacency (including 0 for Outside)
        this.adj = {
            0: [2],
            1: [2, 3],
            2: [0, 1, 4],
            3: [1, 4],
            4: [2, 3]
        };

        this.people = [];
        this.nextPersonId = 1;
        this.lastUpdateTime = 0;
        
        window.addEventListener('resize', () => this.resize());
        this.resize();
        this.animate();
    }

    resize() {
        const img = this.container.querySelector('img');
        if (!img) return;
        const rect = img.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.canvas.style.left = (rect.left - containerRect.left) + 'px';
        this.canvas.style.top = (rect.top - containerRect.top) + 'px';
        this.scale = rect.width / this.baseWidth;
    }

    isPointInPoly(poly, pt) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y;
            const xj = poly[j].x, yj = poly[j].y;
            const intersect = ((yi > pt.y) !== (yj > pt.y))
                && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    getRandomPointInZone(zoneId) {
        const zone = this.zones[zoneId];
        let minX = Math.min(...zone.poly.map(p => p.x));
        let maxX = Math.max(...zone.poly.map(p => p.x));
        let minY = Math.min(...zone.poly.map(p => p.y));
        let maxY = Math.max(...zone.poly.map(p => p.y));
        let pt, attempts = 0;
        do {
            pt = { x: minX + Math.random() * (maxX - minX), y: minY + Math.random() * (maxY - minY) };
            attempts++;
        } while (!this.isPointInPoly(zone.poly, pt) && attempts < 100);
        return pt;
    }

    updateCounts(newCounts) {
        // Calculate current distribution of "settled" people
        const currentCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
        this.people.forEach(p => {
            if (p.state === 'idle' || (p.state === 'moving' && !p.isExiting)) {
                currentCounts[p.zone]++;
            }
        });

        const deltas = {
            1: (newCounts.zone1 || 0) - currentCounts[1],
            2: (newCounts.zone2 || 0) - currentCounts[2],
            3: (newCounts.zone3 || 0) - currentCounts[3],
            4: (newCounts.zone4 || 0) - currentCounts[4]
        };

        // Ripple Logic: Resolve deltas by moving people between adjacent zones
        let changed = true;
        while (changed) {
            changed = false;
            for (let z = 1; z <= 4; z++) {
                if (deltas[z] > 0) { // Needs +1
                    const path = this.findShortestPathTo0(z); // Path from 0 to Z
                    // Ripple backwards from target to entry
                    for (let i = path.length - 1; i > 0; i--) {
                        const to = path[i];
                        const from = path[i-1];
                        if (from === 0) {
                            this.spawnPerson(to);
                        } else {
                            const person = this.people.find(p => p.zone === from && p.state === 'idle');
                            if (person) {
                                this.movePersonToZone(person, to);
                            } else {
                                continue; // Can't ripple yet, wait for someone to become idle
                            }
                        }
                        deltas[to]--;
                        if (from !== 0) deltas[from]++;
                        changed = true;
                        break; 
                    }
                } else if (deltas[z] < 0) { // Needs -1 (Surplus)
                    const path = this.findShortestPathTo0(z); // Path from Z to 0
                    // Ripple forwards from surplus to exit
                    const to = path[1];
                    const from = path[0];
                    const person = this.people.find(p => p.zone === from && p.state === 'idle');
                    if (person) {
                        if (to === 0) this.sendToExit(person);
                        else this.movePersonToZone(person, to);
                        deltas[from]++;
                        if (to !== 0) deltas[to]--;
                        changed = true;
                    }
                }
            }
        }
    }

    findShortestPathTo0(startZone) {
        const queue = [[startZone]];
        const visited = new Set([startZone]);
        while (queue.length > 0) {
            const path = queue.shift();
            const node = path[path.length - 1];
            if (node === 0) return path;
            for (const neighbor of this.adj[node]) {
                // Avoid Zone 4 unless it's the start or end
                if (neighbor === 4 && startZone !== 4) continue;
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push([...path, neighbor]);
                }
            }
        }
        return [startZone, 0]; // Fallback
    }

    spawnPerson(targetZone) {
        const pt = this.getRandomPointInZone(targetZone);
        const person = {
            id: this.nextPersonId++,
            x: this.entryExit.x, y: this.entryExit.y,
            zone: targetZone, state: 'moving', isExiting: false,
            path: this.getGatePath(2, targetZone, this.entryExit, pt),
            speed: 2 + Math.random() * 2, wanderSpeed: 0.2 + Math.random() * 0.3,
            pulse: 0, pulseDir: 1
        };
        this.people.push(person);
    }

    movePersonToZone(person, nextZone) {
        const targetPt = this.getRandomPointInZone(nextZone);
        person.path = this.getGatePath(person.zone, nextZone, {x: person.x, y: person.y}, targetPt);
        person.zone = nextZone;
        person.state = 'moving';
    }

    sendToExit(person) {
        person.path = this.getGatePath(person.zone, 2, {x: person.x, y: person.y}, this.entryExit);
        person.isExiting = true;
        person.state = 'moving';
    }

    getGatePath(from, to, startPt, endPt) {
        const path = [];
        if (from === to) return [endPt];

        const gateKey = from < to ? `${from}-${to}` : `${to}-${from}`;
        const gate = this.gates[gateKey];
        if (gate) {
            // Push gate side coordinates to ensure we walk THROUGH the gate
            path.push(gate[`z${from}`]);
            path.push(gate[`z${to}`]);
        }
        path.push(endPt);
        return path;
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.debug) this.drawDebugZones();

        const now = Date.now();
        this.lastUpdateTime = now;

        for (let i = this.people.length - 1; i >= 0; i--) {
            const p = this.people[i];
            p.pulse += 0.05 * p.pulseDir;
            if (p.pulse > 1 || p.pulse < 0) p.pulseDir *= -1;

            if (p.state === 'moving') {
                if (p.path.length > 0) {
                    const target = p.path[0];
                    const dx = target.x - p.x, dy = target.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 5) {
                        p.path.shift();
                        if (p.path.length === 0) {
                            if (p.isExiting) { this.people.splice(i, 1); continue; }
                            else p.state = 'idle';
                        }
                    } else {
                        p.x += (dx / dist) * p.speed;
                        p.y += (dy / dist) * p.speed;
                    }
                }
            } else if (p.state === 'idle') {
                if (!p.wanderTarget || Math.random() < 0.01) p.wanderTarget = this.getRandomPointInZone(p.zone);
                const dx = p.wanderTarget.x - p.x, dy = p.wanderTarget.y - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 2) {
                    p.x += (dx / dist) * p.wanderSpeed;
                    p.y += (dy / dist) * p.wanderSpeed;
                }
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
        this.ctx.beginPath();
        this.ctx.ellipse(x, y + (size * 0.4), size * 0.6, size * 0.3, 0, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
        this.ctx.fill();
        const isRestricted = this.zones[p.zone].restricted;
        const color = isRestricted ? `rgba(248, 113, 113, ${0.4 + p.pulse * 0.4})` : 'rgba(240, 180, 41, 0.4)';
        const grad = this.ctx.createRadialGradient(x, y, 0, x, y, size * 1.5);
        grad.addColorStop(0, color); grad.addColorStop(1, 'rgba(0,0,0,0)');
        this.ctx.beginPath(); this.ctx.arc(x, y, size * 1.5, 0, Math.PI * 2);
        this.ctx.fillStyle = grad; this.ctx.fill();
        this.ctx.beginPath(); this.ctx.arc(x, y, size * 0.7, 0, Math.PI * 2);
        this.ctx.fillStyle = isRestricted ? '#f87171' : '#F0B429';
        this.ctx.fill();
        this.ctx.beginPath(); this.ctx.arc(x, y - (size * 0.1), size * 0.3, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
        this.ctx.fill();
    }
}
window.PersonnelVisualizer = PersonnelVisualizer;
