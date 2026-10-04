# MASTER PROMPT: REGENERATE THE "GEMSIM" ENTERPRISE ARCHITECTURE & CRISIS SIMULATOR PLATFORM

You are a Principal Full-Stack Software Engineer, a WebGL/Three.js 3D Graphics Specialist, and an Enterprise Systems Architect.
Your task is to build and deploy from scratch the complete, production-grade **GemSim** platform: an interactive, real-time web flight simulator and serious game for enterprise IT governance, technical debt compounding, and architectural crisis management.

---

## 1. PRODUCT VISION & CORE GAMEPLAY LOOP

GemSim is a flight simulator for CTOs, CIOs, Lead Architects, and C-suite leaders to test high-stakes technical decisions without risking real millions.
- **Round Cycle**: 4 sequential quarterly rounds (Q1 to Q4).
- **Core Dilemma**: Balance technical debt reduction, delivery velocity, OpEx run-rates, regulatory compliance (DORA, NIS2, HIPAA/GDPR), and sovereign architectural control while maintaining C-suite stakeholder trust.
- **Decision Loop**: Each quarter, players inspect the 3D digital twin, negotiate 1-on-1 with autonomous AI executives, pitch strategy in an all-hands Boardroom Meeting, select architectural initiatives, and weather unexpected governance crises and black swans.
- **Audience**: The same engine serves non-technical cases (plant acquisition, market expansion, offshore transfer) for executives and MBA students. Each scenario has a **domain** and a **vocabulary** that rename metrics, layers and postures (see section 14).

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
│   └── src/
│       ├── components/
│       │   ├── 3d/EnterpriseCanvas.tsx            # Three.js 3D Spatial Digital Twin
│       │   ├── arena/PlayerArena.tsx              # Quarter decisions, objectives tracker, final verdict
│       │   ├── arena/OutcomePanels.tsx            # Win-condition tracker & end-of-game screen
│       │   ├── arena/MarketPanel.tsx              # Prices, marketing, entries, live projection & P&L
│       │   ├── stakeholder/StakeholderWarRoom.tsx # 1-on-1 & Boardroom AI negotiations, patience, pacts
│       │   ├── warroom/FacilitatorCockpit.tsx     # Multi-squad telemetry, crisis injector, debrief
│       │   ├── warroom/TeamRadarChart.tsx         # Comparative radar
│       │   └── studio/GameStudio.tsx              # Prompt-to-Scenario authoring UI (streamed)
│       │   ├── briefing/ExecutiveBriefingModal.tsx # Case file: context, map, people, 7 objectives, all rules
│       │   ├── help/TutorialTour.tsx              # 13-step guided tour (data-tour anchors)
│       │   ├── help/GlossaryPanel.tsx, InfoTip.tsx # Searchable glossary & accessible tooltips
│       │   ├── help/DemoPlayer.tsx                # Commented replay: disciplined vs shortcut strategy
│       │   └── warroom/crisisTemplates.ts         # Generic injectable crises bound to the scenario
│       ├── i18n/                                  # fr.ts (source), en.ts, game.ts (codes, vocabulary), glossary.ts
│       ├── stores/useSimulationStore.ts           # Zustand global store fed by WebSocket messages
│       ├── stores/useHelpStore.ts                 # Glossary, demo and tutorial visibility
│       ├── engine.ts                              # Re-exports the server's pure rule functions
│       ├── services/api.ts                        # REST/SSE client (facilitator PIN header) + WebSocket
│       └── types/index.ts                         # Re-exports server/src/types (shared types)
├── server/
│   ├── prisma/schema.prisma                       # PostgreSQL schema
│   ├── src/
│   │   ├── ai/
│   │   │   ├── registry.ts                        # Pluggable AI provider gateway & fallback chain
│   │   │   ├── base.ts                            # Shared prompts, JSON & streaming helpers
│   │   │   ├── ollama.ts, gemini.ts, claude.ts, openai.ts, fallback.ts  # Providers
│   │   │   ├── circuit-breaker.ts                 # 3-strike / 60s cooldown resilience
│   │   │   ├── repair-loop.ts                     # Self-healing LLM JSON repair
│   │   │   ├── timeout.ts                         # Explicit configurable deadlines
│   │   │   ├── systemone.ts                       # System 1 client (Clef/Jev /v1/systemone)
│   │   │   ├── stakeholder-judge.ts               # Typed verdicts, trust shifts & board votes
│   │   │   └── studio-generator.ts                # Scenario synthesis & normalization
│   │   ├── engine/
│   │   │   ├── math.ts                            # Formulas (TDI, drag, OpEx, failure risk, seeded roll)
│   │   │   ├── resolver.ts                        # Quarter resolution state machine
│   │   │   ├── rules.ts                           # Budget, capacity, one-time initiatives (shared with client)
│   │   │   ├── outcome.ts                         # Win/loss evaluation (shared with client)
│   │   │   ├── balance.ts                         # Bot strategies, beam search, replayStrategy (demo)
│   │   │   ├── vocabulary.ts                      # Per-domain FR/EN labels for metrics, layers, postures
│   │   │   ├── market.ts                          # Competitive market: logit choice, capacity, P&L, calibration
│   │   │   └── session-service.ts                 # Advance a session (patience recovery, final outcomes)
│   │   ├── services/round-service.ts              # Single round path for REST, WebSocket, BullMQ
│   │   ├── queue/index.ts                         # BullMQ queues & workers
│   │   ├── db/index.ts, db/prisma.ts, db/seeds.ts # SQLite store, PostgreSQL sync, seed scenarios
│   │   ├── routes/                                # REST API (sessions, ai, studio, scenarios, docs)
│   │   ├── socket/handler.ts                      # WebSocket gateway & round timer
│   │   ├── auth.ts                                # Facilitator PIN guard, secret stripping
│   │   ├── validation.ts                          # Zod request schemas
│   │   └── index.ts
│   └── test/                                      # Vitest suites (math, game rules, balance, generation)
├── docs/kit/{fr,en}/                              # Facilitator kit & player manual (served by /api/docs?lang=)
└── Dockerfile, Containerfile & podman-compose.yml
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
When $P(\text{Fail}) > 0.45$ the node is at risk and fails if a seeded roll (hash of session/team/quarter/node) falls under $P(\text{Fail})$, so outcomes are probabilistic but reproducible. Outages trigger emergency recovery expenses ($75K–$350K), velocity penalties (-4, -8 when critical), and SLA violations.

### 5. Stakeholder Trust Function
$$\Delta \text{Trust}_i = \text{clamp}\Big(15 \times \sum (w_{i, k} \times \Delta_k), -25, +25\Big)$$

### 6. Game Rules & Economy (shared pure module `engine/rules.ts`, reused by the client)
- **Budget envelope**: CapEx of started initiatives + crisis response cost + pact budgets must fit the cash available; otherwise the submission is rejected (HTTP 422). An insolvent team may still submit an empty quarter.
- **Delivery capacity**: at most `maxInitiativesPerRound` initiatives per quarter (default 2).
- **One-time, multi-quarter initiatives**: an initiative is bought once; CapEx is paid at start, effects land on completion after `durationRounds`; OpEx deltas are permanent; 50% of the velocity gain persists afterwards.
- **Run vs change budget**: the business funds a quarterly run budget equal to the starting estate's OpEx. Overruns are charged to the change budget; half of savings is returned. TCO accumulates change spending plus overruns.
- **Governance side effects**: Bypass also costs -8 resilience per quarter; Strict +6; compliance under 50% triggers a fine of $6K per missing point and trust losses for compliance-minded executives.
- **Insolvency**: negative cash costs every executive trust weighted by financial focus.
- **Modernized capabilities**: a node becomes MODERNIZED when a completed modernization initiative brings its debt to 50 or below.

### 7. Win / Loss Evaluation (`engine/outcome.ts`)
- 7 objectives: the 6 `winLossConditions` plus solvency (cash ≥ 0), each with partial credit by distance to target; score 0–100.
- **VICTORY** (A+/A) = all met; **PARTIAL** (B/C) = solvent and ≥ 4 met; **DEFEAT** (D/F) otherwise. Missing conditions in generated scenarios fall back to defaults.
- Computed for every team when the last quarter resolves; players see a live objectives tracker and a final verdict screen; facilitator rankings use the score.
- **Grades**: 90 points for reaching targets (partial credit by distance) + 10 for headroom beyond them. VICTORY ≥ 97 is A+, else A; PARTIAL ≥ 80 is B, else C; DEFEAT is D when solvent with ≥ 55, else F.
- **Balance acceptance test (`engine/balance.ts`)**: on every seeded scenario, a beam search over legal quarter decisions must find a VICTORY, the bypass/feature-blitz bot must lose, and Architect > Prudent > Cowboy in score. The Studio runs the same check on generated scenarios and reports it before publishing.
- **Tension mechanics**: shipping creates debt (+1 TDI per 10 velocity points per quarter), resilience erodes by 4 per quarter, only 60% of an initiative's announced debt reduction is realized and returns diminish as debt gets low (and as resilience gets high).

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
   - Each node may set `archetype: 'TOWER' | 'DATABASE' | 'SLAB'` explicitly; otherwise it is inferred from its layer and name.
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
- **Patience meter** per executive and quarter (0–100): empty pitch -30, repetition -35, rejection -20, conditional -8, acceptance +5 (half in the boardroom). At 0 the executive refuses to negotiate until next quarter (-2 trust per attempt) and votes against without an LLM call. +50 recovery each quarter. Patience is passed to System 1 and to the LLM prompt (curt tone below 35).
- **Binding pacts**: a demanded concession can be signed as a pact with a committed budget (`POST /api/sessions/:id/pacts`, server-held so clients cannot forge them). Pacts consume the quarter's budget envelope and are honored at resolution (cost charged, trust +5 to +15).
- Stakeholders see the team's submitted quarter decisions (initiatives with costs, posture, crisis response, pacts, last quarter's results) and react to them concretely.
- **Decision vs. voice separation**: the verdict, trust delta and scores come from the System 1 decision model (see Section 9), including paraphrased-rehash and low-effort detection. The LLM only voices the decision in character.

---

## 6. ALL-HANDS EXECUTIVE BOARDROOM MEETING

In addition to 1-on-1 negotiations, players can convene an All-Hands Executive Committee:
- Player presents their quarterly strategic package to all stakeholders simultaneously.
- **Cross-NPC Debates**: after the vote, the most opposed member rebuts the most supportive one in character (one LLM call; persona resistance line when no LLM is available). No debate when the vote is unanimous.
- Real-time collective consensus meter and formal alignment vote before finalizing the quarter.
- **Board mandate**: the latest resolution of the quarter is stored on the team and applies to that quarter only. APPROVED = +1 initiative capacity and +5 velocity at resolution; CONDITIONAL_QUORUM = EXTREME-risk initiatives blocked; REJECTED (including the anti-repetition sentinel) = -1 capacity (min 1) and HIGH/EXTREME-risk initiatives blocked. Enforced by the shared rule module and shown in the player's portfolio and in the board's resolution message.
- **Single-pass board vote**: all members' verdicts are decided in **one** System 1 call (one question set per stakeholder, shared message-quality questions). The LLM then writes each member's statement.

---

## 7. PROGRESSIVE CRISIS EMERGENCE & BLACK SWANS

- **No Early Spoilers**: Crises are not dumped all at once in Q1.
- **Quarterly Cadence**:
  - **Q1**: Initial governance friction and budget constraints.
  - **Q2**: Delivery velocity bottlenecks or vendor turnover.
  - **Q3 (Black Swan)**: Surprise regulatory audit (DORA/HIPAA) or supply-chain pipeline vulnerability.
  - **Q4**: Cascading systemic failure or successful modernization milestone.
- Facilitators can trigger manual black swan overrides during live multiplayer sessions. The injected crisis applies its impact immediately (no clamping of cash), is not charged again at resolution, and teams that answered the scheduled dilemma must choose again.
- Quarter resolution goes through one service for REST, WebSocket and the BullMQ worker, so injected crises and rules always apply.

---

## 8. PRODUCTION-GRADE AI RESILIENCE LAYER

1. **Token Streaming (`stream: true`)**:
   All dialogue and studio generation endpoints stream tokens via Server-Sent Events (SSE) for zero-latency UI responsiveness (`/api/ai/negotiate/stream`, `/api/studio/generate/stream`; the Studio shows the live JSON tail and ends with the validated scenario and its balance report).
2. **Explicit Configurable Timeouts**:
   Every AI request wraps an `AbortController` with clear timeouts (`AI_CHAT_TIMEOUT_MS` 45s, `AI_STUDIO_TIMEOUT_MS` 300s); local Ollama calls never go below `OLLAMA_MIN_TIMEOUT_MS` (120s) because a model may need to load first.
3. **Circuit Breaker Pattern**:
   - 3 consecutive provider failures $\rightarrow$ Circuit trips `OPEN` for a 60-second cooldown.
   - User receives an immediate friendly message: *"AI provider temporarily pausing for 60s cooldown. Automatic retry enabled."*
4. **Self-Healing JSON Repair Loop**:
   - When a model outputs malformed JSON, avoid silent fallbacks.
   - Execute an automated repair loop (up to 3 attempts) passing the exact syntax/schema error back to the model to correct its JSON.
5. **Pluggable Providers**:
   Adapter pattern supporting Local Ollama (Gemma 2/4), Google Gemini (BYOK), Anthropic Claude (BYOK), OpenAI (BYOK), and a built-in deterministic heuristic fallback.

---

## 9. HYBRID SYSTEM 1 / SYSTEM 2 DECISION LAYER (CLEF / JEV)

Separate **deciding** from **writing**:
- **System 1** is a non-autoregressive decision model: Clef-flash, served by Ollama with the `decision` capability, or any Jev/SystemOne-compatible model. It returns a probability for every option of every typed question in one forward pass, with zero generated tokens and no JSON parsing.
- **System 2** is the LLM gateway from Section 8. It writes dialogue, rationale and concession text conditioned on the System 1 decision.

### API Contract (`POST {SYSTEMONE_BASE_URL}/v1/systemone`)
```json
{
  "model": "clef-flash",
  "state": { "stakeholder": { "bias": "...", "hiddenAgenda": "...", "decisionWeights": {}, "currentTrust": 45 },
             "company": { "round": 2, "budgetRemaining": 900, "technicalDebtIndex": 62 },
             "previousPlayerProposals": ["..."], "playerMessage": "..." },
  "questions": {
    "verdict":     { "type": "choice", "instructions": "...", "criteria": { "ACCEPTED": "...", "CONDITIONAL_ACCEPTANCE": "...", "REJECTED": "..." } },
    "trust_shift": { "type": "score",  "criteria": ["Strongly damaged", "Slightly damaged", "Unchanged", "Slightly improved", "Strongly improved"] },
    "low_effort":  { "type": "noul",   "instructions": "Vague, pressure tactic or flattery without concrete substance?" }
  }
}
```
Response: `answers[id]` contains `{choice, confidence, probabilities}` for `choice` questions, `{score, confidence, legend, probabilities}` for `score` questions (score = expected option index), and `{noul}` (probability of true) for `noul` questions.

### Negotiation Pipeline
1. The anti-cheat sentinel rejects empty and verbatim-repeated messages before any model call.
2. **Judge** (`stakeholder-judge.ts`) asks: `verdict` (choice), `trust_shift`, `empathy`, `financial_acumen` and `strategic_alignment` (scores 0–4), plus `low_effort` and `rehash` (noul).
3. **Mapping** (a pure, unit-tested function):
   - `penalty = max(low_effort, rehash)`.
   - Raise P(REJECTED) by `0.6 × penalty`, scale P(ACCEPTED) by `1 − 0.8 × penalty`, renormalize, then take the top verdict.
   - `trustDelta = clamp(round((trust_shift − 2) × 10 − 10 × penalty), −20, +20)`.
   - Scores become 0–100.
4. **Voice**: the LLM prompt includes a "decision already made" block. The server keeps System 1's verdict and numbers authoritative and keeps the LLM's wording.
5. **Streaming**: emit an SSE `{ "type": "decision", "evaluation": ... }` event before the first dialogue token.
6. `ProposalEvaluation` adds the optional fields `verdictProbabilities` and `decisionEngine`.

### Emergent Behaviour & Resilience
- `SYSTEMONE_STOCHASTIC=true` samples verdicts from the distribution (roulette wheel) instead of argmax, so identical situations can produce different, still credible reactions.
- Graceful degradation: if System 1 is disabled, times out or has an open circuit breaker (3 failures, 60 s), the system falls back to LLM-only evaluation transparently.
- Configuration: `SYSTEMONE_ENABLED`, `SYSTEMONE_BASE_URL` (defaults to `OLLAMA_BASE_URL`), `SYSTEMONE_MODEL` (`clef-flash`), `SYSTEMONE_TIMEOUT_MS` (20000, covers cold model loads), `SYSTEMONE_STOCHASTIC`.
- Health probe: `GET /api/ai/systemone/health`.

### Extension Points (same pattern)
- End-of-round stakeholder reactions that account for hidden agendas.
- An AI storyteller that suggests crises to the facilitator: `noul` "should a crisis occur?" + `choice` among event types.
- Quality gates on Studio-generated scenarios.

---

## 10. FACILITATOR SECURITY

- The facilitator PIN (`FACILITATOR_PIN`) is never serialized to clients (stripped from every REST and WebSocket payload).
- Facilitator actions require the `x-facilitator-pin` header (timing-safe comparison): advance round (except solo sessions), timer, crisis injection, broadcast, reset, session deletion, scenario create/delete, Studio generate/publish, AI settings and provider tests. WebSocket facilitator messages carry the PIN too.
- The client keeps the verified PIN for the browser session and opens the unlock dialog on any HTTP 401.

---

## 11. FLAGSHIP SCENARIO: "HEALTHNOVA: CLINICAL EHR & TELEHEALTH OVERHAUL"

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
- **4 Quarters of Balanced Initiatives**: Strangler Fig EHR migration (2 quarters), FHIR API abstraction, Kafka clinical streaming, Zero-Trust compliance — plus one tempting "direct EHR database query scripts" bypass trap.
- Difficulty EXECUTIVE: the greedy modernization bot only reaches PARTIAL; a VICTORY path exists (verified by the balance beam search).

---

## 12. FACILITATOR COCKPIT (MULTI-TEAM WAR ROOM)

- Multi-squad live synchronization dashboard (1 to 5 squads competing side-by-side).
- Round timer pause/resume, broadcast announcements, and manual black swan injection.
- Executive Post-Mortem Report: Generates comparative radar charts, rankings by win-condition score with grades (A+ to F), and exportable JSON/Markdown audit logs.
- Solo sessions (one team): the player resolves the quarter from the arena after submitting.

---

## 13. DEPLOYMENT & CONTAINERIZATION

- **Podman / Docker Compose**: Rootless, unprivileged container execution (UID `10001`).
- **SELinux Support**: Persistent volume storage flags (`:Z`).
- **License**: 100% Open-Source under the **MIT License** with author attribution.

---

### Persistence & Jobs
- SQLite is the local synchronous store. When `DATABASE_URL` is set, PostgreSQL is the system of record: seeds are pushed to it at startup, its content is loaded into SQLite, and every write and delete is mirrored with per-record ordering.
- When Redis is reachable, quarter resolution runs as a BullMQ job (concurrency 1) awaited by the caller; jobs are logged to `job_logs`. Without Redis the same handler runs inline.
- All mutating endpoints validate their body with Zod (HTTP 400 with issues). Client state lives in a Zustand store fed by WebSocket messages.

---

## 14. LEARNING DESIGN, LANGUAGES & NON-TECHNICAL CASES

### Domains & vocabulary
- `Scenario.domain`: `IT | INDUSTRIAL | MARKET_EXPANSION | SOURCING | GENERIC`. `Scenario.language`: `fr | en`. `Scenario.vocabulary` (optional): labels and descriptions for every metric, the four layers, the four postures and the element noun.
- `resolveVocabulary(scenario, lang)` returns the scenario's own wording when `scenario.language === lang`, otherwise the domain defaults in `lang`. The engine is unchanged: only words change. Nodes may carry an `archetype` (plant, line, warehouse, supplier, site...).
- Initiative categories include neutral ones: `CAPACITY_EXPANSION, OPERATIONS_EXCELLENCE, SOURCING_PARTNERSHIP, MARKET_EXPANSION, RISK_MITIGATION, PEOPLE_CHANGE, QUICK_WIN`. The Studio prompt receives domain guidance and may only use `INITIATIVE_CATEGORIES`; normalization keeps the domain, detects the language and sanitizes the vocabulary.
- Prompts to the stakeholder LLM and the System One judge receive the metric labels, so executives speak the case's language.
- Seed scenario **"Usine de Vénissieux : acquisition et intégration industrielle"** (`scen-industrial-lyon`, INDUSTRIAL, French, EXECUTIVE): 8 elements (line A from 1998, assembly line B, single-source foundry, regional warehouse, site MES/ERP, effluent plant, key accounts, group ERP), 4 executives (CFO, COO, HR director, HSE director), 4 crises, 6 initiatives including a 2-quarter retrofit and a 3x8 EXTREME trap. Balance: best path VICTORY A, Architect bot PARTIAL B, Cowboy DEFEAT F.

### Translatable engine output
- The engine and server never emit display sentences for game facts: quarter notes, stakeholder reactions, rule violations and announcements are `MessageCode { code, params }` and the client translates them (`translateCode`). Incidents carry `nodeName`, `nodeDebt`, `failureProbability`.
- The client has flat FR/EN dictionaries with `{placeholder}` interpolation; a navbar toggle switches the language (persisted in `localStorage`). A test enforces key and placeholder parity and that every code emitted by the server has a translation.

### Help surfaces
- **Case file**: context, map, decision-makers, the 7 victory conditions with starting values (computed by `evaluateOutcome` on the baseline), 13 rules computed from the scenario (run budget, multi-quarter initiatives, posture names...), and a 7-step quarter using the scenario's initiatives as examples.
- **Glossary** (22 concepts + the scenario's metrics) and ⓘ tooltips on the HUD, objectives, postures and patience.
- **Guided tutorial** (13 steps, auto-starts on the first visit) and **practice game** (solo session on the current scenario + tutorial).
- **Commented demo**: `replayStrategy` replays ARCHITECT vs COWBOY on any scenario; the commentary is computed from the real gaps each quarter.
- **Generic crises**: injectable crises (security, outage, investor, audit) target the scenario's most fragile critical element and the executives whose decision weights they touch.
- **Accessibility**: dialogs with `role=dialog`, tabs with `role=tablist`, posture and crisis choices as radio groups, keyboard-operable canvas element list, labelled icon buttons.

### Facilitator kit (`docs/kit/{fr,en}/`)
Player manual, learning objectives with references, workshop agenda (3h30 and 2h), debrief guide, assessment rubric, pilot protocol with a 7-question pre/post quiz, and a guide to adapting a case. Shipped in the container image and served by `GET /api/docs?lang=fr|en`.

---

## 15. COMPETITIVE MARKET & P&L

- **Model** (`Scenario.market`, optional): segments `{ id, name, baseDemand, growth, referencePrice, priceSensitivity, qualitySensitivity, speedSensitivity, reliabilitySensitivity, openAtStart?, entryCost? }`, rivals `{ id, name, priceIndex, quality, aggressiveness, segmentIds? }`, and `unitCost`, `fixedCosts`, `unitsPerCapacityPoint`, `cashRetention`.
- **Decision** (`TeamDecision.market`): price and marketing per segment, segments to enter. Rules: price within 50–200% of the reference, marketing ≥ 0 and only where the team sells, no double entry; marketing and entry fees count in the budget envelope. Last quarter's prices carry over.
- **Clearing** (`clearMarket`, pure, shared with the client): at the start of the quarter, on each team's current metrics. Attractiveness = exp(−3·priceSens·ln(price/ref) + 3·qualSens·(quality−0.5) + 3·speedSens·(velocity/100−0.5) + 3·relSens·(resilience/100−0.5) + 0.6·ln(1+marketing/scale)), quality = (0.6·(100−TDI) + 0.4·compliance)/100, scale = 2% of the segment's reference revenue. Rivals use their price (cut by 3%·aggressiveness per quarter), quality and a 0.6 capability. Shares = attractiveness / total; demand × (N teams + R rivals)/(1 + R) per segment, ±5% seeded shock. Sales capped by velocity × unitsPerCapacityPoint, unserved demand redistributed to sellers with spare capacity and rivals.
- **P&L**: operating profit = revenue − unit cost × units − fixed costs − OpEx − marketing. Program cash += cashRetention × (gross margin − fixed costs − run budget − marketing) − entry fees, applied before insolvency and trust are evaluated. Finance-minded executives read the margin. Metrics `revenue`, `operatingProfit`, `cumulativeProfit`, `marketShare`.
- **Objectives**: `minMarketShare` (scaled by (1+R)/(N+R)) and `minCumulativeProfit`, so a market scenario has 9 objectives; partial success needs half of them.
- **Balance**: bots carry a market style (architect at reference with brand investment, prudent at a premium, cowboy cutting prices); the beam search explores the three styles; `playTournament` runs the three bots in one shared market and the check fails if the price war beats the balanced strategy.
- **Studio**: `withMarket` asks the model for a market; `sanitizeMarket` bounds every number and `calibrateMarket` sets fixed costs so the starting company breaks even and derives missing objectives. Without a usable answer, a generic three-segment market is used.
- **Seeds**: the Vénissieux plant (pumps: industry & automotive, rail & energy, Middle-East export) and **Maison Dumas** (cookware maker opening Germany and Canada against a German premium brand, a low-cost marketplace seller and a Canadian leader). Both: best path VICTORY A+, architect bot alone PARTIAL B, cowboy DEFEAT F; in the tournament the architect wins.
- **UI**: Market tab (prices, marketing, entries, projected share, capacity use, choice drivers, competitors, P&L), market HUD card, P&L in history, market objectives in the tracker and case file, market rule, tutorial step, cockpit columns, radar axis and share/profit-by-quarter debrief table, demo rows and commentary, glossary entries.
- **Secrecy**: REST answers (`playerView` middleware, `x-gemsim-team` header) and WebSocket messages (per-connection replacer) hide other teams' pending decisions from players; a WebSocket join with a valid PIN gets the full view.

---

## EXECUTION INSTRUCTIONS
Generate clean, modular, and fully tested TypeScript code. Unit-test the System 1 answer-to-evaluation mapping without a live model. Ensure all Three.js materials, mathematical state transitions, AI streaming handlers, and UI dashboards compile without errors (`npm run build` client & server with 0 errors, `npm test` passing 100%).
