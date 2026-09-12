import { describe, it, expect } from 'vitest';
import { FallbackProvider } from '../src/ai/fallback.js';
import { StudioScenarioGenerator } from '../src/ai/studio-generator.js';

describe('AI Scenario Studio & Semantic Blueprint Generation', () => {
  const userPrompt = `ransforme les éléments ci-dessous en un scénario complet et opérationnel selon le schéma JSON du moteur de simulation. Définis la topologie 3D spatiale (Onshore vs Offshore), les profils psychologiques des agents autonomes (NPCs), l'arbre de décision sur 4 trimestres et les formules d'impact sur les métriques d'affaires.

1. Identité et Paramètres Généraux
Titre du Scénario : Mirage Offshore : Arbitrage Coûts, Souveraineté et Dette Technique
Secteur : Grande Entreprise de Services / Assurance et Fintech
Format : 4 Tours (représentant 4 trimestres : Q1 à Q4)
Rôle des Joueurs : Direction de l'Architecture d'Entreprise et Gouvernance Technologique
Niveau de Difficulté : Élevé (pression budgétaire agressive du CFO, conflit social interne)

Métriques de référence :
- Dette technique (TDI) : 68
- Vélocité : 48
- Conformité : 85
- Confiance : 40`;

  it('should accurately parse structured French prompt in Fallback/Heuristic engine', () => {
    const scenario = FallbackProvider.createDynamicScenario({
      industry: 'Grande Entreprise de Services / Assurance et Fintech',
      businessChallenge: userPrompt,
      difficulty: 'CRISIS_CHIEF',
    });

    // 1. Title & Metadata
    expect(scenario.title).toBe('Mirage Offshore : Arbitrage Coûts, Souveraineté et Dette Technique');
    expect(scenario.industry).toBe('Grande Entreprise de Services / Assurance et Fintech');
    expect(scenario.totalRounds).toBe(4);

    // 2. Metrics
    expect(scenario.baselineMetrics.technicalDebtIndex).toBe(68);
    expect(scenario.baselineMetrics.deliveryVelocity).toBe(48);
    expect(scenario.baselineMetrics.complianceScore).toBe(85);
    expect(scenario.baselineMetrics.stakeholderTrust).toBe(40);

    // 3. 3D Spatial Topology: Onshore (X < 0), Bridge (X = 0), Offshore (X > 0)
    const nodes = scenario.topology.nodes;
    const onshoreNodes = nodes.filter(n => n.position.x < 0);
    const bridgeNodes = nodes.filter(n => n.position.x === 0);
    const offshoreNodes = nodes.filter(n => n.position.x > 0);

    expect(onshoreNodes.length).toBeGreaterThanOrEqual(3);
    expect(bridgeNodes.length).toBeGreaterThanOrEqual(2);
    expect(offshoreNodes.length).toBeGreaterThanOrEqual(2);

    // Check specific offshore/onshore nodes
    expect(nodes.some(n => n.id.includes('onshore-core') || n.name.toLowerCase().includes('onshore'))).toBe(true);
    expect(nodes.some(n => n.id.includes('offshore-delivery') || n.name.toLowerCase().includes('offshore'))).toBe(true);

    // 4. Stakeholder Personas
    const stakeholders = scenario.stakeholders;
    expect(stakeholders.length).toBeGreaterThanOrEqual(4);
    expect(stakeholders.some(s => s.title.toLowerCase().includes('cfo') || s.role.toLowerCase().includes('coûts'))).toBe(true);
    expect(stakeholders.some(s => s.title.toLowerCase().includes('esn') || s.role.toLowerCase().includes('externalisation'))).toBe(true);
    expect(stakeholders.some(s => s.title.toLowerCase().includes('lead tech') || s.role.toLowerCase().includes('onshore'))).toBe(true);
    expect(stakeholders.some(s => s.title.toLowerCase().includes('ciso') || s.role.toLowerCase().includes('sécurité'))).toBe(true);

    // 5. Timeline Quarters
    expect(scenario.roundEvents.length).toBe(4);
    expect(scenario.roundEvents[0].roundNumber).toBe(1);
    expect(scenario.roundEvents[3].roundNumber).toBe(4);

    // 6. Initiatives Catalog
    expect(scenario.initiativesCatalog.length).toBeGreaterThanOrEqual(6);
    expect(scenario.initiativesCatalog.some(i => i.name.toLowerCase().includes('sablier') || i.name.toLowerCase().includes('paved path'))).toBe(true);
    expect(scenario.initiativesCatalog.some(i => i.name.toLowerCase().includes('quality gates') || i.name.toLowerCase().includes('ci/cd'))).toBe(true);
    expect(scenario.initiativesCatalog.some(i => i.name.toLowerCase().includes('synthétiques') || i.name.toLowerCase().includes('anti-fuite'))).toBe(true);
  });

  it('validateAndEnrich should preserve generated LLM content without wiping it', () => {
    const rawPartial = {
      title: 'Mon Super Scénario Spécifique',
      industry: 'Aéronautique',
      difficulty: 'INTERMEDIATE' as const,
      stakeholders: [
        {
          id: 'sh-custom-1',
          name: 'Directeur Usine',
          title: 'Directeur des Opérations',
          role: 'Production',
          avatar: '🏭',
          personality: 'Direct et pragmatique',
          bias: 'Zéro arrêt de chaîne',
          hiddenAgenda: 'Livrer 50 avions ce mois-ci',
          negotiationTolerance: 50,
          baseTrust: 50,
          decisionWeights: { financialAcumen: 0.3, deliverySpeed: 0.4, architecturalRigor: 0.2, regulatoryCompliance: 0.1 },
          sampleDialogue: { greeting: 'Bonjour', resistance: 'Non', concession: 'Daccord' },
        },
      ],
      topology: {
        nodes: [
          {
            id: 'node-assembly-line',
            name: 'Ligne d\'Assemblage Numérique',
            layer: 'BUSINESS' as const,
            description: 'Ligne connectée',
            health: 80,
            technicalDebt: 20,
            criticalPath: true,
            costPerRound: 50,
            position: { x: 0, y: 0, z: 0 },
            status: 'HEALTHY' as const,
            dependencies: [],
            telemetry: { latencyMs: 10, throughputRps: 100, errorRatePercent: 0, failureRisk: 5 },
          },
        ],
        edges: [],
      },
    };

    const enriched = StudioScenarioGenerator.validateAndEnrich(rawPartial, {
      industry: 'Aéronautique',
      businessChallenge: 'Modernisation des usines',
    });

    expect(enriched.title).toBe('Mon Super Scénario Spécifique');
    // Must NOT have wiped the custom stakeholder
    expect(enriched.stakeholders.some(s => s.name === 'Directeur Usine')).toBe(true);
    // Must NOT have wiped the custom node
    expect(enriched.topology.nodes.some(n => n.name === 'Ligne d\'Assemblage Numérique')).toBe(true);
    // Must have padded to required minima
    expect(enriched.stakeholders.length).toBeGreaterThanOrEqual(3);
    expect(enriched.roundEvents.length).toBe(4);
    expect(enriched.initiativesCatalog.length).toBeGreaterThanOrEqual(4);
  });

  it('evaluateStakeholderProposal should understand French operational context and not blindly accept', async () => {
    const fallback = new FallbackProvider();
    const cfo = {
      id: 'sh-cfo',
      name: 'Jean-Christophe Meyer',
      role: 'Directeur Financier (CFO)',
      title: 'CFO',
      personality: 'Pragmatique et strict',
      bias: 'Pression sur la marge',
      hiddenAgenda: 'Toucher son bonus de rentabilité',
      negotiationTolerance: 40,
      baseTrust: 50,
      decisionWeights: { financialAcumen: 0.5, deliverySpeed: 0.2, architecturalRigor: 0.2, regulatoryCompliance: 0.1 },
      sampleDialogue: { greeting: 'Bonjour', resistance: 'Non', concession: 'Daccord' },
    };

    // Case 1: Player claims "it's purely operational, nothing to do with architecture"
    const res1 = await fallback.evaluateStakeholderProposal({
      stakeholder: cfo,
      currentTrust: 50,
      chatHistory: [],
      playerMessage: "pas du tout c'est purement operationnel ce que j'expose ici, rien avoir avec l'architecture. une facon sur de garantir nos investissements",
      currentRound: 1,
      teamMetrics: { tco: 2000, budgetRemaining: 1500, technicalDebtIndex: 45, deliveryVelocity: 50 },
    });

    // Should push back on operational costs impacting cash burn, NOT blindly award +12
    expect(res1.evaluation.verdict).toBe('CONDITIONAL_ACCEPTANCE');
    expect(res1.evaluation.trustDelta).toBeLessThan(0);
    expect(res1.responseDialogue.toLowerCase()).toContain('opérationnel');
    expect(res1.responseDialogue.toLowerCase()).toContain('opex');

    // Case 2: Player offers quantifiable OpEx commitment and financial discipline
    const res2 = await fallback.evaluateStakeholderProposal({
      stakeholder: cfo,
      currentTrust: 50,
      chatHistory: [],
      playerMessage: "Nous nous engageons sur une baisse d'OpEx de 15% et un plafonnement strict du CapEx pour protéger la marge nette.",
      currentRound: 1,
      teamMetrics: { tco: 2000, budgetRemaining: 1500, technicalDebtIndex: 45, deliveryVelocity: 50 },
    });

    expect(res2.evaluation.verdict).toBe('ACCEPTED');
    expect(res2.evaluation.trustDelta).toBeGreaterThan(0);
    expect(res2.responseDialogue.toLowerCase()).toContain('capex');
  });
});
