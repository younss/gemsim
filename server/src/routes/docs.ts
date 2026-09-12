// ============================================================================
// GEMSIM: SELF-HOSTED DOCUMENTATION REST API
// Embedded documentation hub for architecture, formulas, and user journeys
// ============================================================================

import { Router } from 'express';

export const docsRouter = Router();

export interface DocSection {
  id: string;
  title: string;
  category: 'JOURNEYS' | 'FORMULAS' | 'SCHEMA' | 'AI_GATEWAY' | 'PODMAN';
  summary: string;
  content: string;
}

const SYSTEM_DOCS: DocSection[] = [
  {
    id: 'journey-player',
    title: 'Player Strategy Journey & Turn Lifecycle',
    category: 'JOURNEYS',
    summary: 'Comprehensive guide for players managing an enterprise transformation.',
    content: `
### Player Experience & Turn Lifecycle

Each simulation round represents a discrete strategic execution cycle (e.g. 1 Quarter).

#### Phase 1: Enterprise Assessment
1. **Inspect the 3D Enterprise Topology**: Examine health states across Business, Application, Data, and Infrastructure tiers. Glowing particles indicate active data throughput; yellow or red nodes indicate high technical debt or bottleneck latency.
2. **Review Telemetry Metrics**: Track TCO, remaining Cash Reserves, Technical Debt Index (TDI), Delivery Velocity, and Resilience.

#### Phase 2: Autonomous Stakeholder Negotiation
1. Open the **AI Stakeholder War Room**.
2. Engage with executive personas (CFO, VP Product, Chief Enterprise Architect, Risk Officer).
3. Draft proposals acknowledging their hidden agendas and biases.
4. Watch their trust scores update dynamically based on empathy, fiscal discipline, and architectural rigor.

#### Phase 3: Strategic Portfolio Selection & Governance
1. Allocate capital towards **Modernization Initiatives** (e.g. Strangler Fig, Kafka Streaming, Cloud Migration).
2. Select your **Governance Posture**:
   - *Bypass Architecture*: Boosts short-term feature velocity by +18%, but surges debt by +12% and invites severe compound penalties.
   - *Balanced Agile*: Pragmatic compromise balancing velocity and stability.
   - *Strict Enterprise Governance*: Lowers debt drift to 2.5%, maximizes compliance (+14%), with a minor delivery velocity cost (-10%).
   - *Accelerated Modernization*: Focused tech-debt elimination.
3. Respond to the scheduled **Quarterly Disruption / Crisis**.

#### Phase 4: Resolution & Retrospective
Once the facilitator or timer concludes the round:
- View the diff of metrics before and after the round.
- Check triggered production incidents and outage costs.
- Review compounded debt interest and stakeholder reactions.
    `,
  },
  {
    id: 'journey-facilitator',
    title: 'Facilitator War Room & Live Cockpit Operations',
    category: 'JOURNEYS',
    summary: 'Operational manual for running live competitive simulations with multiple teams.',
    content: `
### Facilitator Cockpit & Real-Time Telemetry

The Facilitator War Room provides real-time oversight of all competing teams in an active simulation session.

#### Capabilities & Overrides
- **Live Leaderboard & Radar Telemetry**: Compare teams side-by-side across TCO, Velocity, Technical Debt, Resilience, and Stakeholder Trust.
- **Round Timer Controls**: Play, pause, or reset the countdown timer synchronized across all connected client browsers.
- **Advance Round Execution**: One-click turn resolution triggering deterministic equations for all teams simultaneously.
- **Event Injection (Black Swan Crises)**: Inject unexpected market shifts (e.g., zero-day vulnerability, sudden traffic spikes, hostile takeover bid).
- **Broadcast Announcements**: Send instant high-priority banner notifications to all player cockpits.
- **Executive Post-Mortem & Debrief**: Export comparative radar charts, round-by-round decision logs, and an executive summary.
    `,
  },
  {
    id: 'math-scoring',
    title: 'Mathematical Scoring Formulas & Technical Debt Modeling',
    category: 'FORMULAS',
    summary: 'Exact mathematical equations driving technical debt compounding, velocity drag, and OpEx.',
    content: `
### Mathematical Formulation of Enterprise Simulation

The simulation engine resolves rounds deterministically using non-linear corporate dynamics:

#### 1. Technical Debt Index (TDI) Compounding
Technical debt acts like financial debt with compound interest:
$$\\Delta TDI_{\\text{compound}} = TDI_{t-1} \\times r_{\\text{compound}}$$

Where $r_{\\text{compound}}$ is determined by governance:
- **Bypass Architecture**: $r = 18\\%$ per round (severe degradation)
- **Balanced Agile**: $r = 8\\%$ per round
- **Strict Governance**: $r = 2.5\\%$ per round
- **Accelerated Modern**: $r = 4.0\\%$ per round

$$TDI_t = \\text{clamp}\\Big(TDI_{t-1} + \\Delta TDI_{\\text{compound}} + \\sum \\Delta TDI_{\\text{initiatives}} + \\Delta TDI_{\\text{event}}, 5, 100\\Big)$$

#### 2. Delivery Velocity Drag
High technical debt creates exponential drag on new feature releases:
$$\\text{Drag\\%} = 70\\% \\times \\left(\\frac{TDI_t}{100}\\right)^{1.4}$$
$$V_{\\text{effective}} = \\text{clamp}\\Big(V_{\\text{base}} \\times (1 - \\text{Drag\\%}) + \\sum V_{\\text{bonuses}}, 8, 100\\Big)$$

#### 3. Operating Expenditure (OpEx) Multiplier
Legacy systems cost progressively more to keep alive as debt mounts:
$$\\text{OpEx}_t = \\sum \\text{NodeCost} \\times \\left(1 + 0.45 \\times \\frac{TDI_t}{100}\\right) + \\Delta \\text{OpEx}_{\\text{active}}$$

#### 4. Incident Probability & Severity
Each node has a failure probability calculated by:
$$P(\\text{Fail}) = \\left(\\frac{\\text{NodeTDI}}{100}\\right)^{2.2} \\times (\\text{Critical} ? 1.6 : 0.9) \\times \\left(1 - \\frac{\\text{Resilience}}{160}\\right)$$
Nodes with $P > 0.45$ risk critical service degradation and emergency recovery expenses.
    `,
  },
  {
    id: 'studio-schema',
    title: 'AI Game Studio & Scenario Schema Specification',
    category: 'SCHEMA',
    summary: 'Technical specification for authoring and synthesizing custom simulation arenas.',
    content: `
### AI Game Studio Scenario Schema

Custom scenarios can be synthesized using natural language prompts or authored directly in JSON.

#### Schema Top-Level Fields:
- \`id\`: Unique scenario string (e.g. \`scen-fintech-neotitan\`)
- \`title\`: Enterprise operation codename
- \`industry\`: Target business vertical
- \`difficulty\`: \`ENTRY\` | \`INTERMEDIATE\` | \`EXECUTIVE\` | \`CRISIS_CHIEF\`
- \`baselineMetrics\`: Initial state (\`tco\`, \`budgetRemaining\`, \`opEx\`, \`technicalDebtIndex\`, \`deliveryVelocity\`, \`resilienceIndex\`, \`complianceScore\`)
- \`topology\`: 3D spatial enterprise graph
  - \`nodes\`: 4 Architectural layers (\`BUSINESS\`, \`APPLICATION\`, \`DATA\`, \`INFRASTRUCTURE\`) with coordinates, health, and latency telemetry.
  - \`edges\`: Network protocols, bandwidth, and bottleneck latency.
- \`stakeholders\`: Autonomous NPCs with decision weights (\`financialAcumen\`, \`deliverySpeed\`, \`architecturalRigor\`, \`regulatoryCompliance\`).
- \`roundEvents\`: 4 scheduled disruptions with choices.
- \`initiativesCatalog\`: Portfolio of investable modernization initiatives.
    `,
  },
  {
    id: 'podman-guide',
    title: 'Podman Rootless Multi-Container Deployment Guide',
    category: 'PODMAN',
    summary: 'Production deployment guide for unprivileged Podman containerization.',
    content: `
### Podman Rootless Deployment Guide

GemSim is architected for unprivileged, rootless multi-container execution using Podman.

#### Security Model
- **Non-Root Execution**: Runs under UID \`10001\` (\`gemsim\`).
- **Read-Only / Isolated Volumes**: State is persisted in \`/app/data\` volume.
- **Port Mapping**: Container port 8089 mapped to host 8089.

#### Quick Start with Podman Compose:
\`\`\`bash
# 1. Copy environment configuration
cp .env.example .env

# 2. Build and launch containers in rootless mode
podman-compose up -d --build

# 3. Check running status
podman-compose ps

# 4. View logs
podman-compose logs -f gemsim-app
\`\`\`

#### Optional Local Ollama Container:
To run with a dedicated local Gemma container:
\`\`\`bash
podman-compose --profile local-ai up -d
podman exec -it gemsim-ollama ollama pull gemma:2b
\`\`\`
    `,
  },
];

docsRouter.get('/', (req, res) => {
  res.json({ docs: SYSTEM_DOCS });
});

docsRouter.get('/:id', (req, res) => {
  const section = SYSTEM_DOCS.find(d => d.id === req.params.id);
  if (!section) {
    return res.status(404).json({ error: 'Documentation section not found' });
  }
  res.json({ doc: section });
});
