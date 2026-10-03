# 💎 GemSim: Enterprise Architecture & Business Strategy Simulation Platform

> **Production-Grade SaaS Platform for Competitive Business Strategy, Enterprise Architecture, and Operations Simulations**

[![Podman](https://img.shields.io/badge/Podman-Rootless%20UID%2010001-892CA0?logo=podman&logoColor=white)](https://podman.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-3D%20WebGL-000000?logo=three.js)](https://threejs.org/)
[![AI Gateway](https://img.shields.io/badge/AI-Pluggable%20BYOK%20%2B%20Ollama-00F0FF)](#1-pluggable-ai-abstraction-layer-bring-your-own-ai)

---

## 🌟 Executive Overview

**GemSim** puts cross-functional corporate teams at the helm of realistic, high-stakes multi-round enterprise scenarios. Facing legacy technical debt, aggressive market challengers, regulatory audits, and budget constraints, teams must balance rapid feature velocity against architectural resilience across discrete execution cycles (Quarters).

The platform features:
- **Interactive 3D Spatial Enterprise Journey**: 4-layer 3D topology canvas (Business, Application, Data, Infrastructure) with live particle telemetry, latency bottlenecks, and health degradation.
- **Autonomous AI Stakeholders**: Executive personas (CFO, VP Product, Chief Enterprise Architect, Compliance Officer) with dynamic trust scoring, hidden agendas, and live proposal negotiations.
- **AI-Powered Game Studio**: Plain-text generative scenario authoring module capable of synthesizing validated arenas, stakeholders, topology graphs, and round timelines on demand.
- **Facilitator War Room Cockpit**: Real-time telemetry monitoring all competing teams, master timer controls, black swan crisis injection, and post-simulation debriefing radar scorecards.
- **Pluggable AI Abstraction Layer ("Bring Your Own AI")**: Seamless runtime switching between Local Ollama (Gemma 4/2), Google Gemini, Anthropic Claude, OpenAI, and a zero-dependency heuristic fallback engine.
- **Hybrid System 1 / System 2 Decisions**: A non-autoregressive decision model (Clef-flash, Jev-compatible) decides stakeholder verdicts, trust shifts and board votes as calibrated probabilities; the LLM only writes the dialogue.
- **Rootless Podman Containerization**: Fully unprivileged multi-container compose architecture running under UID `10001`.

---

## 🎬 Live Simulation Showcase: HealthNova EHR & Telehealth Overhaul

> *Featured Scenario:* **HealthNova: Clinical EHR & Telehealth Overhaul**  
> *Sector:* HealthTech & Hospital Network Operations | *Target:* 4-Quarter Turnaround  
> *The Burning Platform:* 15 regional hospitals facing an Epic/Cerner legacy monolith lock-in, 68% Technical Debt Index, and critical latency bottlenecks during peak telehealth video consultations.

<p align="center">
  <img src="docs/screenshots/healthnova-overview.gif" alt="GemSim HealthNova Simulation Walkthrough" width="95%" style="border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.3);" />
</p>

### 1. 🌌 3D Spatial Enterprise Architecture & Real-Time Telemetry
GemSim visualizes complex multi-tier enterprise systems in real-time WebGL space using advanced architectural metaphors: **multi-story glass slabs**, **fluted wireframe database barrels**, **translucent plinths**, and **floating 3D text billboards**.

| 🏛️ 3D Spatial Enterprise Architecture | 🛰️ 3D Canvas & Node HUD |
| :---: | :---: |
| <img src="docs/screenshots/healthnova-3d-topology.gif" alt="HealthNova 3D Orbit" width="100%" /> | <img src="docs/screenshots/healthnova-topology-3d.png" alt="HealthNova 3D Canvas" width="100%" /> |
| *Continuous 3D orbit around enterprise topology with architectural stacks and data cylinders* | *Interactive 3D canvas featuring node status indicators, ground pedestals, and Live Enterprise Model HUD* |

- **Architectural Stack Metaphor**: Systems are rendered as multi-story glass buildings and fluted wireframe data cylinders representing databases and core microservices.
- **Floating 3D Text Billboards**: High-contrast, always-facing text labels hovering directly above every building for effortless architectural readability without hovering.
- **Ground Pedestals & Halo Rings**: Glass plinths anchor each component onto the perspective grid, with luminous halo rings delineating critical data repositories.
- **Curved Particle Telemetry**: Bezier-curved conduits channel dynamic data flow particles with color-graded latency and bottleneck indicators.

---

### 2. 🤖 Autonomous AI Stakeholder War Room (Live Dynamic Negotiation)
Interact with autonomous C-suite executive personas driven by local or cloud LLMs. Stakeholders evaluate trade-offs, enforce hidden agendas, and adjust trust scores in real time based on semantic proposal analysis.

<p align="center">
  <img src="docs/screenshots/healthnova-ai-negotiation.gif" alt="HealthNova AI Stakeholder Live Negotiation" width="95%" style="border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.3);" />
</p>

| Stakeholder AI Persona Hub | Real-Time Streaming Evaluation Dialogue |
| :---: | :---: |
| <img src="docs/screenshots/healthnova-warroom.png" alt="HealthNova Stakeholder Roster" width="100%" /> | *Dr. Sarah Lin (Chief Medical Officer) dynamically evaluates our FHIR migration proposal, noting clinical stability and awarding +4 Trust points.* |

- **Persona Depth**: **Dr. Sarah Lin (CMO)** prioritizes zero clinician disruption; **David Thornton (CIO)** balances legacy mainframe stability with cloud agility; **Victoria Sterling (CFO)** enforces budget runways.
- **Anti-Cheat Semantic Scoring**: AI stakeholders detect repetitive copy-paste arguments, superficial buzzwords, and budget shortfalls, requiring genuine architectural trade-offs.
- **Patience Meters**: Each executive has a per-quarter patience gauge. Empty pitches (-30), repeats (-35), rejections (-20) and conditional answers (-8) drain it; acceptances restore it (+5). At 0 the executive closes the door until next quarter and votes against in the boardroom. Patience recovers by 50 each quarter.
- **Binding Pacts**: When an executive demands a concession, the player can sign it as a pact with a committed budget. Pacts share the quarter's budget envelope and are honored at resolution (cost charged, trust +5 to +15).
- **Boardroom Debates**: After the vote, the most opposed member rebuts the most supportive one in character.
- **System One Verdicts**: When a System One model is available, verdicts, trust deltas and scores come from typed judgments (with per-verdict probabilities) instead of LLM-generated JSON. See [System One Decision Layer](#-system-one-decision-layer-clef--jev).

---

### 3. 📊 Executive Briefing & Strategic Decision Cockpit
Teams navigate strategic dilemmas across discrete quarterly cycles, balancing modernization investments against urgent operational shocks.

| 📋 Executive Case Briefing | 🛠️ Strategic Modernization Initiatives | ⚖️ Governance & Disruption Shocks |
| :---: | :---: | :---: |
| <img src="docs/screenshots/healthnova-briefing.png" alt="HealthNova Briefing Dossier" width="100%" /> | <img src="docs/screenshots/healthnova-initiatives.png" alt="HealthNova Initiatives Portfolio" width="100%" /> | <img src="docs/screenshots/healthnova-governance.png" alt="HealthNova Governance & Timeline" width="100%" /> |
| *Case briefing with baseline metrics, regulatory mandates, and financial runway.* | *Portfolio decisions: FHIR Integration Layer vs Direct DB Emergency Scripts.* | *Governance posture selection and Q1 Telehealth Consultation Surge shock.* |

- **Executive Briefing Dossier**: Comprehensive problem statement, risk factors, and success criteria displayed upon entering the arena.
- **Modernization Trade-offs**: Choose between high-integrity long-term investments (Strangler Fig pattern, Cloud EHR) or quick high-debt hacks (direct database writes).
- **Governance Postures**: Enforce *Strict Architecture Review* to suppress technical debt compounding or *Bypass Architecture* for temporary velocity boosts.
- **Fog of War Roadmaps**: Progressive quarterly disclosure of unexpected market and operational disruptions.

---

### 4. 🛠️ AI Scenario Studio (Generative Authoring & 3D Synthesis)
Design, synthesize, and validate playable enterprise simulations from plain-text natural language prompts in seconds using local or cloud AI models.

<p align="center">
  <img src="docs/screenshots/studio-generation.gif" alt="GemSim AI Game Studio Generation" width="95%" style="border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.3);" />
</p>

| 3D Topology Preview & Synthesis | 👥 C-Suite Personas & Agendas | 📅 4-Quarter Timeline & Fog of War |
| :---: | :---: | :---: |
| <img src="docs/screenshots/studio-scenario-inspector.png" alt="Studio 3D Topology Preview" width="100%" /> | <img src="docs/screenshots/studio-stakeholders.png" alt="Studio Stakeholder Personas" width="100%" /> | <img src="docs/screenshots/studio-timeline.png" alt="Studio Strategic Timeline" width="100%" /> |
| *Interactive 3D WebGL preview of generated architecture nodes and layer planes.* | *Psychological profiling, cognitive biases, and hidden agendas (Dr. Sarah Lin & David Thornton).* | *Strategic evolution across Q1-Q4 with Author View vs Player Fog of War toggles.* |

- **Natural Language Synthesis**: Enter industry briefs or complex multi-paragraph corporate cases (Healthcare EHR, Core Banking Modernization, Mirage Offshore Sourcing).
- **5-Phase Generation Pipeline**: Progressive real-time compilation from topology graph and competing stakeholder dialectics to crisis roadmaps and mathematical constraint validation.
- **Live Streaming & Balance Report**: The Studio streams the model's JSON as it is written, then runs the balance check (best achievable verdict and bot results) on the generated scenario before you publish.
- **Active AI Engine Diagnostics**: Switch seamlessly at runtime between Local Ollama (`gemma4:12b`), Google Gemini, Claude, OpenAI, or the offline zero-dependency heuristic engine with live latency monitoring.
- **One-Click Publishing**: Instant export and activation directly into the multiplayer simulation library.

---

### 5. 🕹️ Facilitator Master Operations War Room
Empower workshop facilitators, enterprise architects, and executive trainers with a unified mission control cockpit to orchestrate multi-team competitive simulations in real time.

<p align="center">
  <img src="docs/screenshots/facilitator-cockpit.gif" alt="Facilitator Master Operations Cockpit" width="95%" style="border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.3);" />
</p>

| 📊 Multi-Team Telemetry Leaderboard | ⚡ Live Crisis & Black Swan Injector | 🔗 Workshop Invites & Role Isolation |
| :---: | :---: | :---: |
| <img src="docs/screenshots/facilitator-cockpit.png" alt="Facilitator Multi-Team Leaderboard" width="100%" /> | <img src="docs/screenshots/facilitator-crisis.png" alt="Facilitator Crisis Injector" width="100%" /> | <img src="docs/screenshots/facilitator-invites.png" alt="Workshop Team Invite Hub" width="100%" /> |
| *Side-by-side real-time tracking of Alpha, Beta, and Gamma squads (TDI, Velocity, OpEx, Trust).* | *Trigger on-demand systemic shocks (Zero-Day Exploits, Cloud Blackouts, Regulatory Audits).* | *Role-isolated squad join links with strict browser sandboxing and facilitator PIN security.* |

- **Master Simulation Controls**: Synchronized countdown timer, Play/Pause, round advance triggers (Q1 to Q4), and real-time broadcast emergency alerts.
- **Live Crisis & Black Swan Injection**: Test team resilience by triggering unexpected operational emergencies on the fly, forcing squads to adapt their quarterly roadmaps.
- **Role Isolation & Security**: Player squads receive dedicated links restricting access strictly to their arena, protecting facilitator controls and the AI Studio behind PIN authentication.
- **Executive Post-Mortem Debriefing**: Automated comparative radar charts, performance rankings, and exportable executive JSON/Markdown reports at session conclusion.

---

## 🏗️ System Architecture & Decoupled Components

```mermaid
graph TD
    Client["React 18 + Vite + Tailwind SPA"] -->|"REST API (HTTP)"| Server["Node.js + Express API Gateway"]
    Client -->|"Real-Time Telemetry (ws://)"| WSServer["WebSocket Telemetry Gateway"]
    Client -->|"3D WebGL Canvas"| ThreeEngine["Three.js Spatial Visualizer"]

    subgraph BackendCore["Backend Core"]
        Server --> Engine["Deterministic Simulation Engine"]
        Server --> Studio["Game Studio Synthesizer"]
        Server --> AIRegistry["Pluggable AI Abstraction Gateway"]
        Server --> DB["SQLite (WAL) local store"]
        Server --> Queue["BullMQ round queue (Redis, optional)"]
        Queue --> Engine
        DB -->|"write-through + startup sync"| PG["PostgreSQL via Prisma (optional, system of record)"]
        WSServer --> Engine
        WSServer --> DB
    end

    subgraph AIGateway["AI Gateway: Bring Your Own AI"]
        AIRegistry --> Ollama["Local Ollama (Gemma / Llama)"]
        AIRegistry --> Gemini["Google Gemini (BYOK)"]
        AIRegistry --> Claude["Anthropic Claude (BYOK)"]
        AIRegistry --> OpenAI["OpenAI GPT-4o (BYOK)"]
        AIRegistry --> Fallback["Deterministic Heuristic Engine"]
    end

    subgraph SystemOne["System 1: Typed Decisions"]
        Server --> Judge["Stakeholder Judge"]
        Judge --> Clef["Clef-flash via Ollama /v1/systemone"]
    end
```

### Decoupled Subsystems

1. **Simulation Calculation Engine (`server/src/engine/`)**:
   - Turn-based deterministic state machine calculating Technical Debt Index (TDI) compounding, non-linear velocity drag, OpEx multipliers, incident probabilities, and stakeholder trust deltas.
2. **Pluggable AI Gateway (`server/src/ai/`)**:
   - Strategy/Adapter pattern with unified interfaces for structured JSON generation, streaming dialogues, and proposal evaluations.
   - Built-in automatic fallback cascade ensuring 100% operational resilience.
3. **System One Decision Layer (`server/src/ai/systemone.ts`, `server/src/ai/stakeholder-judge.ts`)**:
   - Typed `noul` / `choice` / `score` judgments from a non-autoregressive model; decides negotiation outcomes before the LLM writes dialogue.
4. **AI Game Studio (`server/src/ai/studio-generator.ts`)**:
   - Synthesizes validated, playable scenario schemas from natural language prompts.
5. **Interactive 3D Topology Canvas (`client/src/components/3d/`)**:
   - High-performance Three.js spatial graph with raycast node inspection, isometric layering, and animated particle data pipelines.
6. **Facilitator Telemetry Cockpit (`client/src/components/warroom/`)**:
   - Multi-team synchronization, timer controls, live event injection, comparative radar chart, rankings by win-condition score, and JSON / Markdown debrief exports.
7. **Client State (`client/src/stores/useSimulationStore.ts`)**:
   - Zustand store holding scenarios, sessions, the active session and team, and applying every WebSocket server message.
8. **Request Validation (`server/src/validation.ts`)**:
   - Zod schemas on every mutating endpoint (sessions, decisions, pacts, crisis injection, broadcasts, negotiation, boardroom, studio generation); invalid payloads get HTTP 400 with the issues.

---

## 🎯 Game Rules: Budget, Capacity, Win & Loss

Each quarter's choices are checked by the same pure rule function on the server (`server/src/engine/rules.ts`) and in the UI (`client/src/engine.ts` re-exports it), so the UI shows exactly what the server will accept.

| Rule | Effect |
| :--- | :--- |
| **Budget envelope** | CapEx of started initiatives + crisis response cost + pacts must fit in the cash available. A submission over budget is rejected (HTTP 422). |
| **Delivery capacity** | At most `maxInitiativesPerRound` initiatives per quarter (default 2). |
| **One-time initiatives** | A completed or in-progress initiative cannot be bought again. |
| **Multi-quarter delivery** | CapEx is paid when an initiative starts; its effects land when it completes (`durationRounds`). |
| **Run vs change budget** | The business funds a quarterly run budget equal to the starting estate's OpEx. OpEx above it is charged to the change budget; half of any savings is returned. |
| **Persistent capabilities** | Half of a completed initiative's velocity gain persists in later quarters; OpEx deltas are permanent run-rate changes. |
| **Regulatory fines** | Compliance under 50% costs $6K per point below the threshold, and compliance-minded executives lose trust. |
| **Insolvency** | Negative cash costs every executive trust (weighted by financial focus). The team can still submit an empty quarter. |
| **Incidents** | At-risk nodes (P(Fail) > 0.45) fail on a seeded roll against P(Fail): reproducible per session/team/quarter, not deterministic. Each incident also costs velocity. |
| **Crisis injection** | An injected crisis hits immediately and is not charged again at resolution; teams that answered the old dilemma must choose again. |

| Budget, capacity, multi-quarter delivery & pacts | Patience meters & binding pacts |
| :---: | :---: |
| <img src="docs/screenshots/initiatives-pacts.jpg" alt="Initiative portfolio with capacity, in-delivery and completed initiatives, and a signed pact" width="100%" /> | <img src="docs/screenshots/warroom-patience-pacts.jpg" alt="Stakeholder war room with patience meters and pact signing" width="100%" /> |

### Win / loss evaluation (`server/src/engine/outcome.ts`)

After the final quarter every team gets a verdict against the scenario's `winLossConditions`, plus solvency:

| Verdict | Condition |
| :--- | :--- |
| **VICTORY** (A+/A) | All 7 objectives met (TDI, trust, velocity, resilience, TCO, capabilities modernized, cash ≥ 0). |
| **PARTIAL** (B/C) | Solvent and at least 4 objectives met. |
| **DEFEAT** (D/F) | Otherwise. |

The score (0–100) is 90 points for reaching the targets (partial credit by distance) plus 10 for the headroom beyond them: a narrow win is an A, a dominant one an A+. It ranks teams in the facilitator debrief. Players see a live objectives tracker each quarter and a final verdict screen at the end. A node counts as a modernized capability when a completed modernization initiative brings its debt to 50 or below.

| Final verdict (player) | Debrief: radar & rankings (facilitator) |
| :---: | :---: |
| <img src="docs/screenshots/final-verdict.jpg" alt="Final verdict screen with grade and objectives" width="100%" /> | <img src="docs/screenshots/facilitator-debrief-radar.jpg" alt="Facilitator debrief with comparative radar and graded rankings" width="100%" /> |

**Tension mechanics:** shipping creates debt (+1 TDI per 10 velocity points per quarter), resilience erodes by 4 per quarter, only 60% of an initiative's announced debt reduction is realized, and returns diminish as debt gets low or resilience gets high.

### Balance & playability check (`server/src/engine/balance.ts`)

Three bots play every quarter through the real resolver, and a beam search explores legal decision paths to find the best achievable outcome:

| Scenario | Best path found | Architect bot | Prudent bot | Cowboy bot |
| :--- | :--- | :--- | :--- | :--- |
| NeoTitan (Intermediate) | VICTORY A+ | VICTORY A+ | PARTIAL C | DEFEAT F |
| HealthNova (Executive) | VICTORY A+ | PARTIAL B | PARTIAL B | DEFEAT F |
| Mirage Offshore (Executive) | VICTORY A+ | VICTORY A+ | PARTIAL C | DEFEAT F |

A test fails if any seeded scenario becomes unwinnable or lets the bypass strategy win. The Studio runs the same check on every generated scenario and shows the report before publishing.

### Solo play

When a session has a single team, the player can resolve the quarter from the arena after submitting; no facilitator PIN is needed.

---

## 🔐 Facilitator Security

- The facilitator PIN (`FACILITATOR_PIN`) is never sent to clients: it is stripped from every REST and WebSocket payload.
- Facilitator actions require the `x-facilitator-pin` header, checked server-side: advancing a round (except in solo sessions), timer, crisis injection, broadcast, reset, session deletion, scenario creation/deletion, Studio generation/publication, AI settings and provider tests.
- The client keeps the verified PIN for the browser session and opens the unlock dialog whenever the server answers 401.

---

## 🧮 Mathematical Scoring Formulas

### 1. Technical Debt Compounding Rate ($TDI_t$)
Technical debt compounds like financial debt with variable interest determined by team governance:

$$\Delta TDI_{\text{compound}} = TDI_{t-1} \times r_{\text{compound}}$$

| Governance Posture | Compound Rate ($r$) | Strategy Description |
| :--- | :---: | :--- |
| **Bypass Architecture** | **18.0%** | Feature fast-track; immediate velocity sugar-rush; catastrophic debt accumulation. |
| **Balanced Agile** | **8.0%** | Standard continuous delivery with moderate architectural hygiene. |
| **Accelerated Modernization** | **4.0%** | Dedicated 35% engineering capacity to refactoring and strangler migrations. |
| **Strict Architecture Review** | **2.5%** | Mandatory review board gates; maximum debt containment; audit ready. |

$$TDI_t = \text{clamp}\Big(TDI_{t-1} + \Delta TDI_{\text{compound}} + \sum \Delta TDI_{\text{initiatives}} + \Delta TDI_{\text{event}}, 5, 100\Big)$$

### 2. Delivery Velocity Drag Curve ($V_t$)
High technical debt imposes exponential drag on development teams as engineers spend increasing time fighting outages and patching brittle monoliths:

$$\text{Drag Percentage} = 70\% \times \left(\frac{TDI_t}{100}\right)^{1.4}$$

$$V_{\text{effective}} = \text{clamp}\Big(V_{\text{base}} \times (1 - \text{Drag\\%}) + \sum V_{\text{bonuses}}, 8, 100\Big)$$

*Example: At TDI = 80%, velocity drag reaches 51.5%, slashing a 65-point base velocity down to 31.5 points!*

### 3. Operating Expenditure (OpEx) Run-Rate
Maintenance overhead escalates non-linearly with technical debt:

$$\text{OpEx}_t = \sum_{n \in \text{Nodes}} \text{Cost}(n) \times \left(1 + 0.45 \times \frac{TDI_t}{100}\right) + \Delta \text{OpEx}_{\text{initiatives}}$$

### 4. Node Failure Risk & Production Outages
Each node's failure probability is modeled as:

$$P(\text{Fail}) = \left(\frac{\text{Node TDI}}{100}\right)^{2.2} \times (\text{isCritical} ? 1.6 : 0.9) \times \left(1 - \frac{\text{ResilienceIndex}}{160}\right)$$

When $P(\text{Fail}) > 0.45$, the node is at risk and fails if a seeded roll falls under $P(\text{Fail})$. Outages trigger emergency recovery expenses ($$75K - $$350K) and velocity penalties (-4, or -8 when critical).

### 5. Stakeholder Sentiment Function
Executive trust updates dynamically using weighted vector evaluation:

$$\Delta \text{Trust}_i = \text{clamp}\Big(15 \times \sum (w_{i, k} \times \Delta_k), -25, +25\Big)$$

---

## 🤖 Pluggable AI Abstraction Layer ("Bring Your Own AI")

GemSim provides a unified interface across all major LLM providers:

```typescript
export interface AIProvider {
  checkHealth(): Promise<{ ok: boolean; message: string; latencyMs: number }>;
  generateText(messages: AIMessage[], options?: AIGenerateOptions): Promise<string>;
  generateJSON<T>(messages: AIMessage[], options?: AIGenerateOptions): Promise<T>;
  generateStream(messages: AIMessage[], onChunk: (chunk: string) => void, options?: AIGenerateOptions): Promise<string>;
  evaluateStakeholderProposal(context: StakeholderNegotiationContext): Promise<{ responseDialogue: string; evaluation: ProposalEvaluation }>;
  generateScenario(prompt: ScenarioGenerationPrompt): Promise<Partial<Scenario>>;
}
```

### Supported Providers

1. **Local Ollama (Gemma 4 / Gemma 2)**:
   - Configurable via `OLLAMA_BASE_URL` (default `http://gemsim-ollama:11434` or `http://localhost:11434`).
   - Zero external telemetry, runs completely air-gapped within Podman.
2. **Google Gemini (BYOK)**:
   - Official REST API integration supporting `gemini-1.5-flash` and `gemini-1.5-pro`.
   - Structured JSON mode and high-speed streaming.
3. **Anthropic Claude (BYOK)**:
   - Anthropic messages API supporting `claude-3-5-sonnet-20241022`.
4. **OpenAI (BYOK)**:
   - JSON-object structured outputs supporting `gpt-4o` and `gpt-4o-mini`.
5. **Deterministic Heuristic Engine (Offline Zero-Dependency Fallback)**:
   - Built-in heuristic engine providing coherent, roleplay-accurate dialogues and scenario schemas without external keys or downloads.

---

## 🧠 System One Decision Layer (Clef / Jev)

Stakeholder negotiations split the work between two kinds of model:

| | System 1: decision model | System 2: LLM |
| :--- | :--- | :--- |
| **Model** | Clef-flash (or any Jev/SystemOne-compatible model) | Ollama, Gemini, Claude, OpenAI, or the heuristic fallback |
| **Output** | Probabilities per option, zero generated tokens | Free text |
| **Decides** | Verdict, trust delta, empathy / financial / strategic scores, low-effort and rehash detection | Nothing. It voices the decision in character (dialogue, rationale, concession) |

### How a negotiation is resolved

1. The anti-cheat sentinel filters empty and verbatim-repeated messages (unchanged).
2. `judgeProposal` sends the persona (bias, hidden agenda, decision weights, current trust), company metrics, the last player proposals and the new message to `POST /v1/systemone` with typed questions:
   - `verdict` (`choice`: `ACCEPTED` / `CONDITIONAL_ACCEPTANCE` / `REJECTED`)
   - `trust_shift`, `empathy`, `financial_acumen`, `strategic_alignment` (`score`)
   - `low_effort`, `rehash` (`noul`)
3. The answers map to a `ProposalEvaluation`: trust delta = `(trust_shift − 2) × 10`, minus up to 10 for empty or rehashed pitches, clamped to ±20. Those same signals shift probability toward `REJECTED`.
4. The LLM receives the decision in its prompt and only writes the reply. System One keeps the verdict and the numbers; the LLM's rationale and concession wording are kept.
5. On `/api/ai/negotiate/stream`, a `decision` SSE event is sent before the first dialogue token.
6. In the boardroom, `judgeBoard` scores every board member in **one** System One call.

If the decision model is unreachable or disabled, GemSim falls back to the LLM-only evaluation automatically. A circuit breaker opens after 3 failures, with a 60 s cooldown.

`ProposalEvaluation` gains two optional fields: `verdictProbabilities` (the distribution) and `decisionEngine` (the model that decided).

### Setup

```bash
# The model must expose the "decision" capability in Ollama
ollama list            # clef-flash:latest should be listed
curl -s http://localhost:8089/api/ai/systemone/health
```

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `SYSTEMONE_ENABLED` | `true` | Set to `false` to force LLM-only evaluation |
| `SYSTEMONE_BASE_URL` | `OLLAMA_BASE_URL` | Endpoint serving `/v1/systemone` |
| `SYSTEMONE_MODEL` | `clef-flash` | Decision model name |
| `SYSTEMONE_TIMEOUT_MS` | `20000` | Per-call timeout (covers a cold model load when Ollama swaps models) |
| `SYSTEMONE_STOCHASTIC` | `false` | `true` samples the verdict from its distribution (roulette wheel) for less predictable stakeholders |

**Latency note:** published Clef-flash latencies (~40 ms median) are measured on an H200. On a local Apple Silicon Mac, expect ~0.3 s for a single question, ~1.2 s for a single stakeholder judgment (7 questions) and ~4 s for a 4-member board (22 questions in one call). That is still well below sequential LLM evaluations with JSON repair.

**Memory note:** Clef-flash (Q8) uses ~14 GB. If the decision model and the dialogue LLM cannot both stay loaded, Ollama unloads one to load the other on every negotiation, which adds 10–30 s. On a 24 GB machine, pair Clef-flash with a small dialogue model and set `OLLAMA_MAX_LOADED_MODELS=2`, or use a cloud provider (Gemini, Claude, OpenAI) for System 2.

---

## 🐳 Podman Rootless Deployment Guide

GemSim is purpose-built for rootless, unprivileged container execution adhering to enterprise security standards.

### Security Specifications
- **Unprivileged Non-Root Execution**: Runs under UID `10001` (`gemsim:gemsim`).
- **SELinux Volume Labels**: Persistent storage mapped with `:Z` flag for rootless Podman.
- **Port Mapping**: Container port 8089 exposed to host port 8089.

### Quick Start with Podman Compose

```bash
# 1. Clone repository and navigate to root
cd /path/to/gemsim

# 2. Copy environment configuration
cp .env.example .env

# 3. Build and launch with Podman Compose
podman-compose up -d --build

# 4. Check container health
podman-compose ps

# 5. Access the SaaS application
open http://localhost:8089
```

### Optional: PostgreSQL and Redis

- **PostgreSQL** (`DATABASE_URL`): becomes the system of record. At startup the seed scenarios are pushed to it, then all scenarios, sessions, chat and archived runs are loaded into the local SQLite store, which serves reads and writes through to PostgreSQL (per-record ordered writes, deletes mirrored). Create the schema with `npx prisma db push` in `server/`.
- **Redis** (`REDIS_URL`): quarter resolution runs as a BullMQ job (`simulation-operations`, concurrency 1) whether triggered by REST or WebSocket; jobs are logged to `job_logs` when PostgreSQL is available. Without Redis the same handler runs inline.

`GET /api/health` reports `database` (`sqlite` or `postgresql+sqlite`) and the queue status.

### Running with Dedicated Local Gemma Container

The `podman-compose.yml` includes a local Ollama container:

```bash
# 1. Start both the app and Ollama service
podman-compose up -d

# 2. Pull lightweight Gemma model into the local container volume
podman exec -it gemsim-ollama ollama pull gemma:2b

# 3. In the GemSim Web UI:
# Navigate to Settings (Gear icon) -> Select "Ollama" -> Click "Test Ping" -> Apply Configuration.
```

---

## 🎮 Online Interactive User Journeys

### 1. Player Journey (Cross-Functional Squad)
1. **Analyze Topology**: Open the **3D Spatial Enterprise Canvas** to inspect application nodes, dependencies, and high-debt bottlenecks.
2. **Negotiate with Stakeholders**: Enter the **AI Stakeholder War Room** to propose compromises to the CFO, VP Product, and Chief Architect.
3. **Allocate Portfolio**: Select strategic modernization initiatives (Strangler Fig, Kafka Streaming, Cloud Mesh, Zero-Trust).
4. **Set Governance**: Pick a governance posture (Bypass, Balanced, Strict, Modernize) and address the quarterly crisis.
5. **Submit & Review**: Lock turn decisions and review quarterly outcomes, incident logs, and compounding drift.

### 2. Facilitator Journey (War Room Cockpit)
1. **Launch Session**: Create a simulation session selecting any scenario and setting competing team count (1-5 teams).
2. **Live Telemetry**: Monitor team metrics side-by-side in real time via WebSockets.
3. **Control Flow**: Play/pause round timers, send broadcast announcements, and advance rounds with one click.
4. **Inject Crises**: Trigger black-swan events (Zero-Day Exploit, Cloud Outage) on the fly.
5. **Executive Debrief**: Review comparative radar charts, determine the winning strategy, and export executive JSON/Markdown reports.

### 3. Game Studio Authoring Journey (Scenario Designer)
1. **Generative Prompt**: Enter an industry vertical and business challenge in plain text.
2. **One-Click Synthesis**: The AI Gateway generates a validated multi-tier scenario schema.
3. **Inspect & Tweak**: Preview the 3D topology graph, adjust stakeholder personas, and edit round timelines.
4. **Publish**: Save directly into the game library for immediate multiplayer play.

---

## 🧪 Testing & Verification

GemSim includes automated unit test suites covering the mathematical formulation, turn resolution state machine, and fallback AI provider:

```bash
# Run test suite
npm test
```

Test Results:
```
 ✓ server/src/ai/stakeholder-judge.test.ts (5 tests)
 ✓ server/test/math.test.ts (8 tests)
 ✓ server/test/game-rules.test.ts (19 tests)
 ✓ server/test/scenario-generation.test.ts (3 tests)
 ✓ server/src/ai/production-enhancements.test.ts (4 tests)

 Test Files  5 passed (5)
      Tests  39 passed (39)
```

`game-rules.test.ts` covers the budget and capacity rules, one-time and multi-quarter initiatives, run-budget economics, insolvency, pacts, crisis injection, seeded incidents, win/loss verdicts, request validation (Zod) and the balance check of every seeded scenario. `npm test` works from the repository root or from `server/`.

---

## 📜 License & Copyright

Distribué sous licence **MIT**. Libre d'utilisation, d'étude, de modification, de reproduction et d'exploitation commerciale (vente), sous réserve de conserver la mention de copyright et la notice de licence originale attribuée à l'auteur :

```text
Copyright (c) 2026 Younss - Tous droits réservés sous licence MIT.
```
Consultez le fichier [LICENSE](LICENSE) pour le texte intégral.
