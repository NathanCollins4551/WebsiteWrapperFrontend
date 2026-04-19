/**
 * PersonnelVisualizer.js
 * High-performance Canvas Personnel Visualizer for MakerSpace Digital Twin.
 * Handles coordinate scaling, pathfinding through gates, and idle wandering.
 */

class PersonnelVisualizer {
    constructor(canvasId, containerId) {
        this.canvas = document.getElementById(canvasId);
        this.container = document.getElementById(containerId);
        this.ctx = this.canvas.getContext('2d');
        
        // Logical resolution
        this.baseWidth = 2752;
        this.baseHeight = 1536;

        // Debug mode: Set to true to see the zone polygons
        this.debug = false; 
        
        // Entry/Exit
        this.entryExit = { x: 2098, y: 411 };
        
        // Zones
        this.zones = {
            1: {
                poly: [{x:610,y:284}, {x:1305,y:278}, {x:1306,y:674}, {x:1152,y:675}, {x:1151,y:743}, {x:615,y:740}],
                restricted: false
            },
            2: {
                poly: [{x:1347,y:281}, {x:1844,y:284}, {x:1852,y:343}, {x:2133,y:350}, {x:2147,y:507}, {x:1816,y:508}, {x:1805,y:749}, {x:1479,y:750}, {x:1478,y:677}, {x:1353,y:677}],
                restricted: false
            },
            3: {
                poly: [{x:634,y:783}, {x:631,y:1070}, {x:718,y:1074}, {x:725,y:1261}, {x:1082,y:1248}, {x:1092,y:1382}, {x:1306,y:1381}, {x:1299,y:1015}, {x:1152,y:1020}, {x:1143,y:789}],
                restricted: false
            },
            4: {
                poly: [{x:1491,y:798}, {x:1828,y:802}, {x:1829,y:1146}, {x:2276,y:1138}, {x:2284,y:1346}, {x:2075,y:1345}, {x:2069,y:1256}, {x:1839,y:1261}, {x:1836,y:1355}, {x:1367,y:1361}, {x:1361,y:1041}, {x:1517,y:1043}],
                restricted: true
            }
        };

        // Transition Gates (Centers)
        this.gates = {
            "1-2": { a: {x:1264,y:476}, b: {x:1375,y:476} },
            "1-3": { a: {x:875,y:723}, b: {x:875,y:829} },
            "3-4": { a: {x:1276,y:1135}, b: {x:1395,y:1135} },
            "4-2": { a: {x:1671,y:820}, b: {x:1671,y:723} }
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

        // Get the actual displayed dimensions of the image content
        const rect = img.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();

        // Match canvas size to the displayed image size precisely
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        // Position canvas exactly over the image (handling centering)
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
        // Simple bounding box for the zone to sample from
        let minX = Math.min(...zone.poly.map(p => p.x));
        let maxX = Math.max(...zone.poly.map(p => p.x));
        let minY = Math.min(...zone.poly.map(p => p.y));
        let maxY = Math.max(...zone.poly.map(p => p.y));

        let pt;
        let attempts = 0;
        do {
            pt = {
                x: minX + Math.random() * (maxX - minX),
                y: minY + Math.random() * (maxY - minY)
            };
            attempts++;
        } while (!this.isPointInPoly(zone.poly, pt) && attempts < 50);
        return pt;
    }

    updateCounts(newCounts) {
        const currentCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
        this.people.forEach(p => {
            if (!p.exiting) currentCounts[p.zone]++;
        });

        // 1. Handle Deficits (Remove people)
        for (let z = 1; z <= 4; z++) {
            let diff = currentCounts[z] - (newCounts[`zone${z}`] || 0);
            while (diff > 0) {
                const person = this.people.find(p => p.zone === z && !p.exiting && !p.movingToOtherZone);
                if (person) {
                    this.sendToExit(person);
                    diff--;
                } else break;
            }
        }

        // 2. Handle Surpluses (Add people)
        for (let z = 1; z <= 4; z++) {
            let diff = (newCounts[`zone${z}`] || 0) - currentCounts[z];
            while (diff > 0) {
                this.spawnPerson(z);
                diff--;
            }
        }
    }

    spawnPerson(targetZone) {
        const person = {
            id: this.nextPersonId++,
            x: this.entryExit.x,
            y: this.entryExit.y,
            targetX: this.entryExit.x,
            targetY: this.entryExit.y,
            zone: targetZone,
            actualZone: 0, // 0 = outside/entry
            path: [],
            speed: 2 + Math.random() * 2,
            wanderSpeed: 0.2 + Math.random() * 0.3,
            state: 'moving',
            exiting: false,
            pulse: 0,
            pulseDir: 1
        };

        // Calculate path from entry to target zone
        person.path = this.calculatePath(0, targetZone);
        this.people.push(person);
    }

    sendToExit(person) {
        person.exiting = true;
        person.state = 'moving';
        person.path = this.calculatePath(person.zone, 0);
    }

    calculatePath(fromZone, toZone) {
        // Simplified pathfinding through gates
        const path = [];
        
        if (fromZone === 0) { // Spawning
            // Entry is closest to Zone 2
            if (toZone === 2) {
                path.push(this.getRandomPointInZone(2));
            } else if (toZone === 1) {
                path.push(this.gates["1-2"].b);
                path.push(this.gates["1-2"].a);
                path.push(this.getRandomPointInZone(1));
            } else if (toZone === 4) {
                path.push(this.gates["4-2"].b);
                path.push(this.gates["4-2"].a);
                path.push(this.getRandomPointInZone(4));
            } else if (toZone === 3) {
                path.push(this.gates["1-2"].b);
                path.push(this.gates["1-2"].a);
                path.push(this.gates["1-3"].a);
                path.push(this.gates["1-3"].b);
                path.push(this.getRandomPointInZone(3));
            }
        } else if (toZone === 0) { // Exiting
            if (fromZone === 2) {
                path.push(this.entryExit);
            } else if (fromZone === 1) {
                path.push(this.gates["1-2"].a);
                path.push(this.gates["1-2"].b);
                path.push(this.entryExit);
            } else if (fromZone === 4) {
                path.push(this.gates["4-2"].a);
                path.push(this.gates["4-2"].b);
                path.push(this.entryExit);
            } else if (fromZone === 3) {
                path.push(this.gates["1-3"].b);
                path.push(this.gates["1-3"].a);
                path.push(this.gates["1-2"].a);
                path.push(this.gates["1-2"].b);
                path.push(this.entryExit);
            }
        }

        return path;
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Debug: Draw Zones
        if (this.debug) {
            Object.keys(this.zones).forEach(id => {
                const z = this.zones[id];
                this.ctx.beginPath();
                z.poly.forEach((p, i) => {
                    if (i === 0) this.ctx.moveTo(p.x * this.scale, p.y * this.scale);
                    else this.ctx.lineTo(p.x * this.scale, p.y * this.scale);
                });
                this.ctx.closePath();
                this.ctx.strokeStyle = z.restricted ? 'rgba(255,0,0,0.5)' : 'rgba(240,180,41,0.5)';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                this.ctx.fillStyle = z.restricted ? 'rgba(255,0,0,0.1)' : 'rgba(240,180,41,0.1)';
                this.ctx.fill();
            });
        }

        const now = Date.now();
        const dt = now - this.lastUpdateTime;
        this.lastUpdateTime = now;

        for (let i = this.people.length - 1; i >= 0; i--) {
            const p = this.people[i];

            // 1. Handle Pulse for Zone 4
            p.pulse += 0.05 * p.pulseDir;
            if (p.pulse > 1 || p.pulse < 0) p.pulseDir *= -1;

            // 2. Movement Logic
            if (p.state === 'moving') {
                if (p.path.length > 0) {
                    const target = p.path[0];
                    const dx = target.x - p.x;
                    const dy = target.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 5) {
                        p.path.shift();
                        if (p.path.length === 0) {
                            if (p.exiting) {
                                this.people.splice(i, 1);
                                continue;
                            } else {
                                p.state = 'idle';
                            }
                        }
                    } else {
                        p.x += (dx / dist) * p.speed;
                        p.y += (dy / dist) * p.speed;
                    }
                }
            } else if (p.state === 'idle') {
                // Wander behavior
                if (!p.wanderTarget || Math.random() < 0.01) {
                    p.wanderTarget = this.getRandomPointInZone(p.zone);
                }
                
                const dx = p.wanderTarget.x - p.x;
                const dy = p.wanderTarget.y - p.y;
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

    drawPerson(p) {
        const s = this.scale;
        const x = p.x * s;
        const y = p.y * s;
        const size = 18 * s;

        // Shadow
        this.ctx.beginPath();
        this.ctx.ellipse(x, y + (size * 0.4), size * 0.6, size * 0.3, 0, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
        this.ctx.fill();

        // Glow/Aura
        const isRestricted = this.zones[p.zone].restricted;
        const color = isRestricted ? `rgba(248, 113, 113, ${0.4 + p.pulse * 0.4})` : 'rgba(240, 180, 41, 0.4)';
        
        const grad = this.ctx.createRadialGradient(x, y, 0, x, y, size * 1.5);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, size * 1.5, 0, Math.PI * 2);
        this.ctx.fillStyle = grad;
        this.ctx.fill();

        // Body
        this.ctx.beginPath();
        this.ctx.arc(x, y, size * 0.7, 0, Math.PI * 2);
        this.ctx.fillStyle = isRestricted ? '#f87171' : '#F0B429';
        this.ctx.shadowBlur = 10 * s;
        this.ctx.shadowColor = isRestricted ? '#f87171' : '#F0B429';
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        // Head highlight
        this.ctx.beginPath();
        this.ctx.arc(x, y - (size * 0.1), size * 0.3, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
        this.ctx.fill();
    }
}

// Export for use in dashboard.html
window.PersonnelVisualizer = PersonnelVisualizer;
