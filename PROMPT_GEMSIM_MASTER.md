# MASTER PROMPT: REGENERATE THE "GEMSIM" ENTERPRISE ARCHITECTURE & CRISIS SIMULATOR PLATFORM

You are a Principal Full-Stack Software Engineer, a WebGL/Three.js 3D Graphics Specialist, and an Enterprise Systems Architect.
Your task is to build and deploy from scratch the complete, production-grade **GemSim** platform: an interactive, real-time web flight simulator and serious game for enterprise IT governance, technical debt compounding, and architectural crisis management.

---

## 1. PRODUCT VISION & CORE GAMEPLAY LOOP

GemSim is a flight simulator for CTOs, CIOs, Lead Architects, and C-suite leaders to test high-stakes technical decisions without risking real millions.
- **Round Cycle**: 4 sequential quarterly rounds (Q1 to Q4).
- **Core Dilemma**: Balance technical debt reduction, delivery velocity, OpEx run-rates, regulatory compliance (DORA, NIS2, HIPAA/GDPR), and sovereign architectural control while maintaining C-suite stakeholder trust.
- **Decision Loop**: Each quarter, players inspect the 3D digital twin, negotiate 1-on-1 with autonomous AI executives, pitch strategy in an all-hands Boardroom Meeting, select architectural initiatives, and weather unexpected governance crises and black swans.

---

## 2. SYSTEM ARCHITECTURE & TECH STACK

### Frontend (`client/`)
- **Framework**: React 18+ / Vite / TypeScript (strict mode).
- **Styling**: Tailwind CSS, Lucide Icons, glassmorphism dark theme (`slate-900` / `zinc-900` palette with neon cyan, emerald, purple, and amber accents).
- **3D Graphics**: Three.js (`r160`+ or `r186`) with `@types/three` managed natively in a responsive React canvas component with `OrbitControls`.
- **State Management**: Reactive session stores (Zustand or React Context) managing real-time telemetry.

### Backend (`server/`)
- **Runtime**: Node.js (Express or Fastify) in TypeScript with schema validation (Zod).
- **Persistence & ORM**: Prisma ORM targeting PostgreSQL for production, with zero-setup SQLite (`better-sqlite3`) for local/offline developer mode.
- **Job Orchestration**: BullMQ + Redis for asynchronous background simulation processing and event queuing.
- **Real-Time Streaming**: Server-Sent Events (SSE) or WebSockets for token-by-token LLM dialogues and live multi-team facilitator telemetry.

### Project Layout
```
gemsim/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── 3d/EnterpriseCanvas.tsx       # Three.js 3D Spatial Digital Twin
│   │   │   ├── warroom/StakeholderWarRoom.tsx # 1-on-1 & Boardroom AI Negotiations
│   │   │   ├── cockpit/FacilitatorCockpit.tsx # Multi-squad telemetry & crisis injector
│   │   │   └── studio/ScenarioStudio.tsx      # Prompt-to-Scenario authoring UI
│   │   ├── stores/useSimulationStore.ts       # Global client state
│   │   └── types/index.ts
├── server/
│   ├── src/
│   │   ├── ai/
│   │   │   ├── gateway.ts                    # Pluggable AI provider gateway
│   │   │   ├── circuit-breaker.ts            # 3-strike / 60s cooldown resilience
│   │   │   ├── json-repair-loop.ts           # Self-healing LLM schema repair
│   │   │   └── providers/                    # Ollama, Gemini, Claude, OpenAI, Heuristic
│   │   ├── simulation/
│   │   │   ├── engine.ts                     # Deterministic quarterly state machine
│   │   │   └── math.ts                       # Formulas (TDI, drag, OpEx, failure risk)
│   │   ├── db/
│   │   │   ├── schema.prisma                 # Postgres schema definition
│   │   │   └── seeds.ts                      # Reference scenario seeds
│   │   └── index.ts
├── shared/types.ts                           # Shared Zod schemas & TypeScript types
└── Dockerfile & podman-compose.yml
```

---

## 3. MATHEMATICAL SIMULATION ENGINE

The state of the enterprise SI is governed by a deterministic, non-linear mathematical model:

### 1. Technical Debt Index Compounding ($TDI_t$)
Technical debt compounds like financial debt with variable interest determined by team governance:
$$\Delta TDI_{\text{compound}} = TDI_{t-1} \times r_{\text{compound}}$$
- **Bypass Architecture**: $r = 18.0\%$ (Fast-track features, catastrophic debt accumulation)
- **Balanced Agile**: $r = 8.0\%$ (Standard delivery, moderate hygiene)
- **Accelerated Modernization**: $r = 4.0\%$ (35% capacity reserved for refactoring)
- **Strict Architecture Review**: $r = 2.5\%$ (Mandatory review board gates)

$$TDI_t = \text{clamp}\Big(TDI_{t-1} + \Delta TDI_{\text{compound}} + \sum \Delta TDI_{\text{initiatives}} + \Delta TDI_{\text{event}}, 5, 100\Big)$$

### 2. Delivery Velocity Drag Curve ($V_t$)
High technical debt imposes exponential drag on development teams:
$$\text{Drag Percentage} = 70\% \times \left(\frac{TDI_t}{100}\right)^{1.4}$$
$$V_{\text{effective}} = \text{clamp}\Big(V_{\text{base}} \times (1 - \text{Drag\\%}) + \sum V_{\text{bonuses}}, 8, 100\Big)$$

### 3. Operating Expenditure (OpEx) Run-Rate
Maintenance overhead escalates non-linearly with technical debt:
$$\text{OpEx}_t = \sum_{n \in \text{Nodes}} \text{Cost}(n) \times \left(1 + 0.45 \times \frac{TDI_t}{100}\right) + \Delta \text{OpEx}_{\text{initiatives}}$$

### 4. Node Failure Probability & Production Outages
$$P(\text{Fail}) = \left(\frac{\text{Node TDI}}{100}\right)^{2.2} \times (\text{isCritical} ? 1.6 : 0.9) \times \left(1 - \frac{\text{ResilienceIndex}}{160}\right)$$
When $P(\text{Fail}) > 0.45$, production outages trigger emergency recovery expenses, velocity penalties, and SLA violations.

### 5. Stakeholder Trust Function
$$\Delta \text{Trust}_i = \text{clamp}\Big(15 \times \sum (w_{i, k} \times \Delta_k), -25, +25\Big)$$

---

## 4. 3D SPATIAL DIGITAL TWIN (THREE.JS `EnterpriseCanvas.tsx`)

Render an interactive, high-end 3D architectural digital twin matching modern enterprise design systems:

1. **HTML Canvas Container**:
   ```html
   <div class="topology-stage">
     <canvas data-engine="three.js r186" aria-label="Interactive 3D enterprise topology. Use node buttons below for keyboard access."></canvas>
   </div>
   ```
2. **Architectural Building Archetypes**:
   - **Stacked Glass Slabs (`TOWER`)**: Multi-story glass structures representing gateways, CI/CD pipelines, and delivery hubs (`MeshPhysicalMaterial` with transmission 0.65, roughness 0.15, and neon beveled edge outlines via `LineSegments(EdgesGeometry)`).
   - **Fluted Wireframe Cylinders (`DATABASE`)**: Vertical glass barrels with vertical wireframe fluting ribs and pulsating ground halo rings for databases, vaults, and compliance stores.
   - **Solid Glass Slabs (`SLAB`)**: Clean translucent blocks for business logic and core microservices.
   - **Ground Pedestals (Plinths)**: Dark translucent podiums anchoring each building to the isometric ground grid.
3. **Floating 3D Text Billboards**:
   - Crisp 2D canvas texture (1024x256) rendered onto a Three.js `Sprite` hovering above each building.
   - Configure with `depthTest: false` and `depthWrite: false` so labels are 100% sharp and never clipped by surrounding glass geometry.
   - Billboards constantly face the camera (`sprite.quaternion.copy(camera.quaternion)`).
4. **Dynamic Data Conduits & Telemetry**:
   - Dependency links rendered as smooth `QuadraticBezierCurve3` conduits.
   - Animated glowing photon particles traveling along curves to visualize real-time data flow and latency bottlenecks.
5. **Interactive Controls**:
   - `LIVE ENTERPRISE MODEL` badge, smooth camera reset with kinetic tweening, fullscreen toggle, continuous auto-orbit, and raycast node inspection.

---

## 5. AUTONOMOUS C-SUITE STAKEHOLDERS & ANTI-CHEAT SENTINEL

### Executive Personas
- **Chief Financial Officer (CFO)**: Fixated on OPEX reduction, cash runway, and immediate ROI. Skeptical of "invisible refactoring".
- **Chief Information Security Officer / Head of Architecture**: Protective of sovereignty, strict on DORA/NIS2/HIPAA compliance, relentlessly pushing back on technical shortcuts.
- **VP of Product / Delivery Director**: Demands high release cadence, SLA adherence, and rapid user-facing feature delivery.

### Anti-Cheat Semantic Scoring & Psychological Resistance
- The LLM stakeholder **never** blindly awards trust.
- Detects copy-paste spam, hollow promises, and lack of budget allocation.
- Tracks patience and skepticism meters: repeated vague arguments decrease patience and trigger active negotiation resistance.

---

## 6. ALL-HANDS EXECUTIVE BOARDROOM MEETING

In addition to 1-on-1 negotiations, players can convene an All-Hands Executive Committee:
- Player presents their quarterly strategic package to all stakeholders simultaneously.
- **Cross-NPC Debates**: Executives argue among themselves (e.g. CISO challenges CFO’s cuts to automated testing; Delivery Director defends release schedule).
- Real-time collective consensus meter and formal alignment vote before finalizing the quarter.

---

## 7. PROGRESSIVE CRISIS EMERGENCE & BLACK SWANS

- **No Early Spoilers**: Crises are not dumped all at once in Q1.
- **Quarterly Cadence**:
  - **Q1**: Initial governance friction and budget constraints.
  - **Q2**: Delivery velocity bottlenecks or vendor turnover.
  - **Q3 (Black Swan)**: Surprise regulatory audit (DORA/HIPAA) or supply-chain pipeline vulnerability.
  - **Q4**: Cascading systemic failure or successful modernization milestone.
- Facilitators can trigger manual black swan overrides during live multiplayer sessions.

---

## 8. PRODUCTION-GRADE AI RESILIENCE LAYER

1. **Token Streaming (`stream: true`)**:
   All dialogue and studio generation endpoints stream tokens via Server-Sent Events (SSE) for zero-latency UI responsiveness.
2. **Explicit Configurable Timeouts**:
   Every AI request wraps an `AbortController` with clear timeouts (e.g. 20s for dialogue, 45s for scenario synthesis), avoiding 300s hanging connections.
3. **Circuit Breaker Pattern**:
   - 3 consecutive provider failures $\rightarrow$ Circuit trips `OPEN` for a 60-second cooldown.
   - User receives an immediate friendly message: *"AI provider temporarily pausing for 60s cooldown. Automatic retry enabled."*
4. **Self-Healing JSON Repair Loop**:
   - When a model outputs malformed JSON, avoid silent fallbacks.
   - Execute an automated repair loop (up to 3 attempts) passing the exact syntax/schema error back to the model to correct its JSON.
5. **Pluggable Providers**:
   Adapter pattern supporting Local Ollama (Gemma 2/4), Google Gemini (BYOK), Anthropic Claude (BYOK), OpenAI (BYOK), and a built-in deterministic heuristic fallback.

---

## 9. FLAGSHIP SCENARIO: "HEALTHNOVA: CLINICAL EHR & TELEHEALTH OVERHAUL"

Pre-seed the database with the flagship enterprise scenario:
- **Context**: 15 regional hospitals facing legacy EHR monolith lock-in, 68% Technical Debt Index, and critical video consultation latency during peak telehealth hours.
- **8 Spatial Topology Nodes**:
  1. `Legacy EHR Core` (Data layer, monolithic database cylinder)
  2. `Clinical Data Ingestion` (Service slab, HL7/FHIR pipeline)
  3. `Telehealth Video Gateway` (Tower slab, WebRTC media gateway)
  4. `Patient Mobile Portal` (Service slab, API layer)
  5. `Analytics & Reporting Engine` (Fluted cylinder, warehouse)
  6. `Identity & Zero-Trust Auth` (Tower slab, security guardrail)
  7. `Third-Party Pharmacy Integration` (Service slab, partner gateway)
  8. `Disaster Recovery Vault` (Fluted cylinder, secure data vault)
- **Stakeholder Roster**:
  - Dr. Sarah Lin (Chief Medical Officer) - Clinical stability & zero physician burnout
  - David Thornton (Chief Information Officer) - Mainframe modernization & uptime
  - Victoria Sterling (Chief Financial Officer) - Budget runway & OpEx containment
- **4 Quarters of Balanced Initiatives**: Strangler Fig EHR migration, FHIR API abstraction, Kafka clinical streaming, Zero-Trust compliance.

---

## 10. FACILITATOR COCKPIT (MULTI-TEAM WAR ROOM)

- Multi-squad live synchronization dashboard (1 to 5 squads competing side-by-side).
- Round timer pause/resume, broadcast announcements, and manual black swan injection.
- Executive Post-Mortem Report: Generates comparative radar charts, resilience rankings (A+ to F), and exportable JSON/Markdown audit logs.

---

## 11. DEPLOYMENT & CONTAINERIZATION

- **Podman / Docker Compose**: Rootless, unprivileged container execution (UID `10001`).
- **SELinux Support**: Persistent volume storage flags (`:Z`).
- **License**: 100% Open-Source under the **MIT License** with author attribution.

---

## EXECUTION INSTRUCTIONS
Generate clean, modular, and fully tested TypeScript code. Ensure all Three.js materials, mathematical state transitions, AI streaming handlers, and UI dashboards compile without errors (`npm run build` client & server with 0 errors, `npm test` passing 100%).
