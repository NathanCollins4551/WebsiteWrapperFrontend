/**
 * PersonnelVisualizer.js
 * High-performance Canvas Personnel Visualizer for MakerSpace Digital Twin.
 * Handles strict pathfinding through gates and direct multi-zone movement.
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
        
        // Safety Waypoints for complex zones to avoid cutting corners
        this.zoneWaypoints = {
            2: { x: 1600, y: 450 } // Deep inside the upper body of Z2
        };

        this.zones = {
            1: { poly: [{x:610,y:284}, {x:1305,y:278}, {x:1306,y:674}, {x:1152,y:675}, {x:1151,y:743}, {x:615,y:740}], restricted: false },
            2: { poly: [{x:1347,y:281}, {x:1844,y:284}, {x:1852,y:343}, {x:2133,y:350}, {x:2147,y:507}, {x:1816,y:508}, {x:1805,y:749}, {x:1479,y:750}, {x:1478,y:677}, {x:1353,y:677}], restricted: false },
            3: { poly: [{x:634,y:783}, {x:631,y:1070}, {x:718,y:1074}, {x:725,y:1261}, {x:1082,y:1248}, {x:1092,y:1382}, {x:1306,y:1381}, {x:1299,y:1015}, {x:1152,y:1020}, {x:1143,y:789}], restricted: false },
            4: { poly: [{x:1491,y:798}, {x:1828,y:802}, {x:1829,y:1146}, {x:2276,y:1138}, {x:2284,y:1346}, {x:2075,y:1345}, {x:2069,y:1256}, {x:1839,y:1261}, {x:1836,y:1355}, {x:1367,y:1361}, {x:1361,y:1041}, {x:1517,y:1043}], restricted: true }
        };

        this.gates = {
            "1-2": { z1: {x:1264,y:476}, z2: {x:1375,y:476} },
            "1-3": { z1: {x:875,y:723}, z3: {x:875,y:829} },
            "3-4": { z3: {x:1276,y:1135}, z4: {x:1395,y:1135} },
            "4-2": { z4: {x:1671,y:820}, z2: {x:1671,y:723} }
        };

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
        const currentCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
        this.people.forEach(p => {
            if (!p.isExiting) currentCounts[p.zone]++;
        });

        for (let z = 1; z <= 4; z++) {
            let diff = (newCounts[`zone${z}`] || 0) - currentCounts[z];
            
            if (diff > 0) {
                while (diff > 0) {
                    // On first update, spawn people directly in the zone
                    if (this.isFirstUpdate) this.spawnPerson(z, true);
                    else this.spawnPerson(z, false);
                    diff--;
                }
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
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push([...path, neighbor]);
                }
            }
        }
        if (avoidZone4) return this.findShortestPath(from, to, false);
        return [from, to];
    }

    getGatePath(from, to, endPt) {
        const zoneSequence = this.findShortestPath(from, to);
        const fullPath = [];
        
        for (let i = 0; i < zoneSequence.length - 1; i++) {
            const zCurrent = zoneSequence[i];
            const zNext = zoneSequence[i+1];
            
            // Special handling for Entry (0) to Zone 2
            if (zCurrent === 0 && zNext === 2) {
                fullPath.push(this.zoneWaypoints[2]); // Move to waypoint to ensure safe entry
                continue;
            }
            if (zCurrent === 2 && zNext === 0) {
                fullPath.push(this.zoneWaypoints[2]);
                fullPath.push(this.entryExit);
                continue;
            }

            const gateKey = zCurrent < zNext ? `${zCurrent}-${zNext}` : `${zNext}-${zCurrent}`;
            const gate = this.gates[gateKey];
            if (gate) {
                // If leaving Z2, pass through waypoint first to clear the notch
                if (zCurrent === 2 && !fullPath.includes(this.zoneWaypoints[2])) {
                    fullPath.push(this.zoneWaypoints[2]);
                }
                
                fullPath.push(gate[`z${zCurrent}`]);
                fullPath.push(gate[`z${zNext}`]);
            }
        }
        fullPath.push(endPt);
        return fullPath;
    }

    spawnPerson(targetZone, instant = false) {
        const pt = this.getRandomPointInZone(targetZone);
        const person = {
            id: this.nextPersonId++,
            x: instant ? pt.x : this.entryExit.x, 
            y: instant ? pt.y : this.entryExit.y,
            zone: targetZone, 
            state: instant ? 'idle' : 'moving', 
            isExiting: false,
            path: instant ? [] : this.getGatePath(0, targetZone, pt),
            speed: 2.5 + Math.random() * 1.5, 
            wanderSpeed: 0.2 + Math.random() * 0.3,
            pulse: 0, 
            pulseDir: 1
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
