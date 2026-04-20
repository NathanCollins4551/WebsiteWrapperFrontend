/**
 * PersonnelVisualizer.js
 * High-performance Canvas Personnel Visualizer for MakerSpace Digital Twin.
 * RESTRUCTURED: Walk-Jump-Walk architecture with strict boundary enforcement.
 */

class PersonnelVisualizer {
    constructor(canvasId, containerId) {
        this.canvas = document.getElementById(canvasId);
        this.container = document.getElementById(containerId);
        this.ctx = this.canvas.getContext('2d');
        
        this.baseWidth = 2752;
        this.baseHeight = 1536;

        this.debug = false; 
        this.entryExit = { x: 2098, y: 411 };
        this.isFirstUpdate = true;
        
        // Safety Hubs (Safe navigation centers for each zone)
        this.hubs = {
            1: { x: 950, y: 500 },
            2: { x: 1700, y: 600 },
            3: { x: 950, y: 1100 },
            4: { x: 1600, y: 1100 }
        };

        // Safety Waypoints for Entry/Exit to clear the Z4 corner
        this.z2DoorWaypoint = { x: 1700, y: 411 };

        this.zones = {
            1: { poly: [{x:610,y:284}, {x:1305,y:278}, {x:1306,y:674}, {x:1152,y:675}, {x:1151,y:743}, {x:615,y:740}], restricted: false },
            2: { poly: [{x:1347,y:281}, {x:1844,y:284}, {x:1852,y:343}, {x:2133,y:350}, {x:2147,y:507}, {x:1816,y:508}, {x:1805,y:749}, {x:1479,y:750}, {x:1478,677}, {x:1353,y:677}], restricted: false },
            3: { poly: [{x:634,y:783}, {x:631,y:1070}, {x:718,y:1074}, {x:725,y:1261}, {x:1082,y:1248}, {x:1092,y:1382}, {x:1306,y:1381}, {x:1299,y:1015}, {x:1152,y:1020}, {x:1143,y:789}], restricted: false },
            4: { poly: [{x:1491,y:798}, {x:1828,y:802}, {x:1829,y:1146}, {x:2276,y:1138}, {x:2284,y:1346}, {x:2075,y:1345}, {x:2069,y:1256}, {x:1839,y:1261}, {x:1836,y:1355}, {x:1367,y:1361}, {x:1361,y:1041}, {x:1517,y:1043}], restricted: true }
        };

        this.gates = {
            "1-2": { z1: {x:1264,y:476}, z2: {x:1375,y:476} },
            "1-3": { z1: {x:875,y:723}, z3: {x:875,y:829} },
            "3-4": { z3: {x:1276,y:1135}, z4: {x:1395,y:1135} },
            "4-2": { z4: {x:1671,y:820}, z2: {x:1671,y:723} }
        };

        this.adj = { 0: [2], 1: [2, 3], 2: [0, 1, 4], 3: [1, 4], 4: [2, 3] };
        this.people = [];
        this.nextPersonId = 1;
        
        window.addEventListener('resize', () => this.resize());
        this.resize();
        this.animate();
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
        let pt, attempts = 0;
        let minX = Math.min(...zone.poly.map(p => p.x)), maxX = Math.max(...zone.poly.map(p => p.x));
        let minY = Math.min(...zone.poly.map(p => p.y)), maxY = Math.max(...zone.poly.map(p => p.y));
        do {
            pt = { x: minX + Math.random() * (maxX - minX), y: minY + Math.random() * (maxY - minY) };
            attempts++;
        } while (!this.isPointInPoly(zone.poly, pt) && attempts < 100);
        return attempts >= 100 ? { ...this.hubs[zoneId] } : pt;
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

    findShortestPath(from, to, avoidZone4 = true) {
        const queue = [[from]];
        const visited = new Set([from]);
        while (queue.length > 0) {
            const path = queue.shift();
            const node = path[path.length - 1];
            if (node === to) return path;
            for (const neighbor of this.adj[node]) {
                if (avoidZone4 && neighbor === 4 && from !== 4 && to !== 4) continue;
                if (!visited.has(neighbor)) { visited.add(neighbor); queue.push([...path, neighbor]); }
            }
        }
        if (avoidZone4) return this.findShortestPath(from, to, false);
        return [from, to];
    }

    getGatePath(from, to, endPt) {
        const zoneSequence = this.findShortestPath(from, to);
        const segments = [];
        
        for (let i = 0; i < zoneSequence.length - 1; i++) {
            const zCurr = zoneSequence[i];
            const zNext = zoneSequence[i+1];
            
            // 1. SAFE WALK to Gate A
            if (zCurr === 0 && zNext === 2) {
                segments.push({ x: this.entryExit.x, y: this.entryExit.y, type: 'jump' });
                segments.push({ x: this.z2DoorWaypoint.x, y: this.z2DoorWaypoint.y, type: 'walk', zone: 2 });
            } else if (zCurr === 2 && zNext === 0) {
                segments.push({ x: this.hubs[2].x, y: this.hubs[2].y, type: 'walk', zone: 2 });
                segments.push({ x: this.z2DoorWaypoint.x, y: this.z2DoorWaypoint.y, type: 'walk', zone: 2 });
                segments.push({ x: this.entryExit.x, y: this.entryExit.y, type: 'walk', zone: 2 });
            } else {
                const gateKey = zCurr < zNext ? `${zCurr}-${zNext}` : `${zNext}-${zCurr}`;
                const gate = this.gates[gateKey];
                const ptA = gate[`z${zCurr}`];
                const ptB = gate[`z${zNext}`];
                
                // WALK through hub to Gate A
                segments.push({ x: this.hubs[zCurr].x, y: this.hubs[zCurr].y, type: 'walk', zone: zCurr });
                segments.push({ x: ptA.x, y: ptA.y, type: 'walk', zone: zCurr });
                
                // JUMP to Gate B
                segments.push({ x: ptB.x, y: ptB.y, type: 'jump' });
            }
        }
        
        // Final WALK to destination
        if (to !== 0) {
            segments.push({ x: this.hubs[to].x, y: this.hubs[to].y, type: 'walk', zone: to });
            segments.push({ x: endPt.x, y: endPt.y, type: 'walk', zone: to });
        } else {
            segments.push({ x: this.entryExit.x, y: this.entryExit.y, type: 'jump' });
        }
        
        return segments;
    }

    spawnPerson(targetZone, instant = false) {
        const pt = this.getRandomPointInZone(targetZone);
        const person = {
            id: this.nextPersonId++,
            x: instant ? pt.x : this.entryExit.x, y: instant ? pt.y : this.entryExit.y,
            zone: targetZone, state: instant ? 'idle' : 'moving', isExiting: false,
            path: instant ? [] : this.getGatePath(0, targetZone, pt),
            speed: 2.5 + Math.random() * 1.5, wanderSpeed: 0.2 + Math.random() * 0.3,
            pulse: 0, pulseDir: 1
        };
        this.people.push(person);
    }

    sendToExit(person) {
        person.path = this.getGatePath(person.zone, 0, this.entryExit);
        person.isExiting = true;
        person.state = 'moving';
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.debug) this.drawDebugZones();

        for (let i = this.people.length - 1; i >= 0; i--) {
            const p = this.people[i];
            p.inRestricted = this.isPointInPoly(this.zones[4].poly, { x: p.x, y: p.y });
            p.pulse += 0.05 * p.pulseDir;
            if (p.pulse > 1 || p.pulse < 0) p.pulseDir *= -1;

            let dx = 0, dy = 0, seg = null;
            if (p.state === 'moving' && p.path.length > 0) {
                seg = p.path[0];
                const tdx = seg.x - p.x, tdy = seg.y - p.y;
                const dist = Math.sqrt(tdx * tdx + tdy * tdy);
                if (dist < 5) {
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
                    seg = { type: 'walk', zone: p.zone }; // Idle wander is always a WALK
                }
            }

            // BOUNDARY ENFORCEMENT
            if (seg && seg.type === 'walk') {
                const poly = this.zones[seg.zone].poly;
                if (this.isPointInPoly(poly, { x: p.x + dx, y: p.y + dy })) {
                    p.x += dx; p.y += dy;
                } else if (this.isPointInPoly(poly, { x: p.x + dx, y: p.y })) {
                    p.x += dx; // Slide X
                } else if (this.isPointInPoly(poly, { x: p.x, y: p.y + dy })) {
                    p.y += dy; // Slide Y
                } else if (p.state === 'idle') {
                    p.wanderTarget = null;
                }
            } else {
                p.x += dx; p.y += dy; // JUMP
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
