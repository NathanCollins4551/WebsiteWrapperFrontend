# MakerSpace Digital Twin — Frontend

A high-performance, security-hardened web portal for real-time 3D visualization, personnel tracking, and AI-driven industrial management. This project serves as the interface for the MakerSpace Digital Twin ecosystem.

##  Tech Stack

### Core Technologies
*   **Runtime:** Node.js (>=20.0.0)
*   **Framework:** Express.js (4.19.2)
*   **3D Engine:** Unity WebGL (served via specialized Brotli-compressed stream)
*   **Visualization:** HTML5 Canvas API (Personnel Visualizer)
*   **Styling:** Modern Vanilla CSS (Modular)

### Security & Authentication
*   **Identity:** JWT (JSON Web Tokens) with `jsonwebtoken` (9.0.2)
*   **Middleware:** Helmet.js for CSP and security header enforcement
*   **Encryption:** Cookie-based session persistence with `HttpOnly` and `Secure` flags
*   **Validation:** Multi-factor Authentication (2FA) integration with backend coordination

---

## Security Architecture

### Authentication Flow
The system implements a robust proxy-authentication model:
1.  **Handshake:** Frontend captures credentials and normalizes them for the backend API.
2.  **2FA Challenge:** During login, the backend may issue a 2FA requirement. The frontend manages the verification state machine across `login.html` and `verify-2fa.html`.
3.  **Cookie Management:** 
    *   **Local Token:** Upon successful auth, a `token` cookie is set (HttpOnly) for frontend session management.
    *   **Backend Forwarding:** Backend-issued cookies (e.g., `trusted_device`) are transparently forwarded to ensure seamless multi-service identity.
4.  **Protected Routes:** 
    *   **Server-Side:** `requireAuth` middleware protects HTML pages and the `/unity` asset directory.
    *   **Asset Protection:** Unity WebGL files are served only after token validation to prevent unauthorized access to proprietary 3D models.

### Cross-Origin Isolation
To support `SharedArrayBuffer` (required by modern Unity builds), the server enforces strict COOP/COEP/CORP headers:
*   `Cross-Origin-Embedder-Policy: require-corp`
*   `Cross-Origin-Opener-Policy: same-origin`
*   `Cross-Origin-Resource-Policy: cross-origin`

---

##  Dashboard: Technical Overview

The dashboard is a modular Single Page Application (SPA) architecture designed for low-latency telemetry visualization.

### 1. Digital Twin Visualization (Unity WebGL)
*   **Streaming:** Utilizes an authenticated iframe to load the Unity build.
*   **Compression:** Server-side support for `.unityweb` files with `Content-Encoding: br` (Brotli) and correct MIME types for WASM execution.

### 2. Personnel Tracking & Zone Monitoring
*   **Data Resolution:** Implements a "Majority-Vote" polling algorithm. Every 6 seconds, the system samples 3 data points from the CV API to filter noise and ensure consistent personnel counts.
*   **Hybrid Modes:**
    *   **Live Mode:** Proxies an MJPEG video stream through the Express server to bypass CORS and Mixed-Content restrictions.
    *   **Simulation Mode:** Uses an incremental state-machine to simulate realistic personnel movement between zones.
*   **Canvas Rendering:** Real-time rendering of subject markers on top of the MakerSpace floor plan.

### 3. AI Assistant (Convai Integration)
*   **Stateful Chat:** Integrates with an external LLM agent via authenticated REST calls.
*   **Telemetry Transparency:** Features a "Source Data" inspector allowing operators to view the raw JSON telemetry used by the AI to generate responses.

### 4. Inventory Management Calculators
A suite of technical inventory tools implementing standard industrial engineering formulas:
*   **EOQ:** Economic Order Quantity (Square root of demand/holding ratio)
*   **ROP:** Reorder Point (Daily usage * Lead time + Safety Stock)
*   **TIC:** Total Inventory Cost (Ordering cost + Carrying cost)

---

##  Project Structure

```text
├── src/
│   ├── server.js           # Entry point & middleware orchestration
│   ├── routes/             # Modular route handlers (Auth, API, Pages)
│   ├── middleware/         # Security, Auth, and Unity-specific logic
│   └── services/           # Backend API communication layer
├── public/
│   ├── dashboard.html      # Structural HTML
│   ├── css/                # Externalized stylesheets
│   └── js/dashboard/       # Modular feature logic (AI, Tracking, Prefs)
└── vercel.json             # Deployment configuration
```

##  Getting Started

1.  **Environment Setup:** Create a `.env` file based on `.env.example`.
    ```bash
    PORT=3000
    BACKEND_URL=https://localhost:5017
    JWT_SECRET=your-secure-secret
    ```
2.  **Installation:**
    ```bash
    npm install
    ```
3.  **Development:**
    ```bash
    npm run dev
    ```
4.  **Production:**
    ```bash
    npm start
    ```
