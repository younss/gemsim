// ============================================================================
// GEMSIM: DETERMINISTIC HEURISTIC FALLBACK AI PROVIDER
// Zero-dependency offline engine ensuring 100% operational resilience out-of-the-box
// ============================================================================

import { BaseAIProvider } from './base.js';
import {
  AIMessage,
  AIGenerateOptions,
  StakeholderNegotiationContext,
  ScenarioGenerationPrompt,
} from './types.js';
import {
  AIProviderType,
  ProposalEvaluation,
  Scenario,
  TopologyNode,
  TopologyEdge,
  InitiativeTemplate,
  RoundEvent,
  StakeholderPersona,
} from '../types/index.js';

export class FallbackProvider extends BaseAIProvider {
  public readonly providerType: AIProviderType = 'fallback';

  public async checkHealth(): Promise<{ ok: boolean; message: string; latencyMs: number }> {
    return {
      ok: true,
      message: 'Zero-Dependency Heuristic Engine Active (Guaranteed 100% availability)',
      latencyMs: 1,
    };
  }

  public async generateText(messages: AIMessage[], options?: AIGenerateOptions): Promise<string> {
    const lastMsg = messages[messages.length - 1]?.content || '';

    if (options?.responseFormat === 'json') {
      return JSON.stringify({
        status: 'success',
        source: 'Heuristic Simulation Engine',
        analysis: `Evaluated inputs against enterprise architecture heuristics.`,
      });
    }

    return `Autonomous Heuristic Engine: Processed strategy directives for '${lastMsg.substring(0, 40)}...'. All constraints validated against architectural baseline.`;
  }

  public async generateStream(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    options?: AIGenerateOptions
  ): Promise<string> {
    const response = await this.generateText(messages, options);
    const tokens = response.split(' ');
    for (const token of tokens) {
      onChunk(token + ' ');
      await new Promise(r => setTimeout(r, 15));
    }
    return response;
  }

  public async evaluateStakeholderProposal(
    context: StakeholderNegotiationContext
  ): Promise<{ responseDialogue: string; evaluation: ProposalEvaluation }> {
    const msg = context.playerMessage.toLowerCase();
    const s = context.stakeholder;

    const isFrench = /(?:[éàèùâêîôûëïç]|bonjour|merci|nous|vous|pour|dans|avec|coût|dette|archi|projet|stratégie|budget|marge|prestataire|opération)/i.test(context.playerMessage) ||
                     /(?:[éàèùâêîôûëïç]|directeur|responsable|chef|président)/i.test(s.title);

    let empathyScore = 50;
    let financialAcumenScore = 50;
    let strategicAlignmentScore = 50;
    let trustDelta = 0;
    let verdict: 'ACCEPTED' | 'REJECTED' | 'CONDITIONAL_ACCEPTANCE' = 'CONDITIONAL_ACCEPTANCE';
    let rationale = '';
    let responseDialogue = '';
    let concessionRequired: string | undefined = undefined;

    // Detect tone & content keywords (French + English)
    const hasFinancialCare = /budget|co[uû]t|cost|roi|capex|opex|d[eé]pense|marge|rentabilit[eé]|financ|tr[eé]sorerie|spend|savings|efficient|investiss/i.test(msg);
    const hasSpeedCare = /deliver|livr|d[eé]lai|deadline|timeline|fast|rapide|expedite|mvp|speed|time-to-market|fonctionnalit[eé]|feature|urgence|q[1-4]/i.test(msg);
    const hasArchCare = /refactor|dette|debt|resilien|r[eé]sili|scale|scalab|modern|s[eé]curit[eé]|security|standards|norme|clean|cloud|souverain|legacy/i.test(msg);
    const hasOpsCare = /op[eé]ration|infra|serveur|process|incident|panne|astringence|disponibilit[eé]|sla|run/i.test(msg);
    const hasSourcingCare = /prestataire|esn|offshore|onshore|sourcing|fournisseur|contrat|externe/i.test(msg);
    const hasSecurityCare = /s[eé]curit[eé]|security|audit|conformit[eé]|compliance|rgpd|zero-trust|chiffr|tls/i.test(msg);
    const hasCollaboration = /understand|comprend|partner|parten|compromise|compromis|collabor|agree|accord|protect|prot[eé]g|listen|[eé]cout/i.test(msg);

    if (hasCollaboration) empathyScore += 25;
    if (hasFinancialCare) financialAcumenScore += 30;
    if (hasArchCare || hasSecurityCare) strategicAlignmentScore += 25;

    const hasConcreteFinancialMetrics = /capex|opex|roi|marge|\d+%|baisse|r[eé]duction|plafond|cut|savings|burn/i.test(msg);

    // Evaluate based on role & persona context
    const roleLower = (s.role + ' ' + s.title).toLowerCase();

    if (roleLower.includes('finance') || roleLower.includes('cfo') || roleLower.includes('financier')) {
      if (hasOpsCare && !hasConcreteFinancialMetrics) {
        // Player tried to argue "purely operational, nothing to do with architecture" without concrete OpEx/CapEx cut
        trustDelta = -5;
        verdict = 'CONDITIONAL_ACCEPTANCE';
        rationale = isFrench ? 'Le volet opérationnel pèse lourdement sur le cash burn sans garantie de ROI.' : 'Operational expenses impact cash burn without clear ROI proof.';
        responseDialogue = isFrench
          ? `Vous tentez d'isoler l'opérationnel de l'architecture. Mais pour la direction financière, le 'run' et la maintenance représentent 70% de nos dépenses ! Si vous voulez garantir nos investissements, montrez-moi où se trouve la baisse concrète d'OpEx ou le ROI net.`
          : `You are trying to separate operations from architecture, but operating maintenance represents 70% of our expenditure! If you want to safeguard investments, show me the concrete OpEx reduction or bottom-line ROI.`;
        concessionRequired = isFrench ? 'Chiffrer une trajectoire d\'économies d\'OpEx d\'au moins 15%.' : 'Commit to at least 15% reduction in ongoing OpEx.';
      } else if (hasConcreteFinancialMetrics || hasFinancialCare) {
        trustDelta = +10;
        verdict = 'ACCEPTED';
        rationale = isFrench ? 'Apprécie la discipline budgétaire et la responsabilité financière.' : 'Appreciates budget discipline and fiscal accountability.';
        responseDialogue = isFrench
          ? `J'apprécie votre souci de rigueur financière et de maîtrise du cash burn. Si nous plafonnons le CapEx ce trimestre et sanctuarisons notre marge, vous avez mon accord pour engager cette tranche.`
          : `I appreciate that you are keeping cash burn front and center. If we can keep CapEx capped this quarter, you have my backing on the modernization tranche.`;
      } else {
        trustDelta = -8;
        verdict = 'CONDITIONAL_ACCEPTANCE';
        rationale = isFrench ? 'Sceptique face à des dépenses ou intentions non quantifiées.' : 'Skeptical of unquantified expenditure or intentions.';
        responseDialogue = isFrench
          ? `Vous me demandez des moyens et du budget sans démontrer le ROI net pour l'entreprise. Où sont les économies concrètes ? J'ai besoin de chiffres vérifiables avant d'engager les finances du groupe.`
          : `You are asking for capital and organizational bandwidth without showing the bottom-line ROI. Where is the OpEx reduction down the line? I need numbers before I sign off.`;
        concessionRequired = isFrench ? 'S\'engager sur une baisse de 15% des coûts de maintenance legacy.' : 'Commit to a 15% reduction in ongoing legacy maintenance OpEx.';
      }
    } else if (roleLower.includes('product') || roleLower.includes('vp') || roleLower.includes('métier') || roleLower.includes('business')) {
      if (hasSpeedCare) {
        trustDelta = +12;
        verdict = 'ACCEPTED';
        rationale = isFrench ? 'Soutient la vélocité de la roadmap et la compétitivité marché.' : 'Supports roadmap velocity and market competitiveness.';
        responseDialogue = isFrench
          ? `Voilà qui est constructif. Si cette approche nous permet de livrer les fonctionnalités client sans attendre des semaines de revues de comités d'architecture, vous avez mon plein soutien.`
          : `Now we're talking. If this enables us to ship user features without waiting 6 weeks for architecture review boards, you have my full support.`;
      } else {
        trustDelta = -7;
        verdict = 'REJECTED';
        rationale = isFrench ? 'Perçoit la démarche comme un ralentissement bureaucratique des livraisons.' : 'Perceives proposal as bureaucratic delay to business features.';
        responseDialogue = isFrench
          ? `Nos concurrents déploient en continu pendant que nous débattons de schémas techniques. Je refuse tout gel des livraisons si les dates de mise en production ne sont pas fermement garanties.`
          : `Our competitors are releasing weekly while we debate database schemas. I can't support another freeze unless delivery dates are guaranteed.`;
        concessionRequired = isFrench ? 'Accélérer en parallèle les fonctionnalités utilisateur prioritaires.' : 'Fast-track high-priority user feature releases concurrently.';
      }
    } else if (roleLower.includes('architect') || roleLower.includes('cto') || roleLower.includes('tech') || roleLower.includes('développeur')) {
      if (hasArchCare) {
        trustDelta = +12;
        verdict = 'ACCEPTED';
        rationale = isFrench ? 'Adhésion forte aux bonnes pratiques et à la résorption de la dette technique.' : 'Strong endorsement of sound engineering and technical debt remediation.';
        responseDialogue = isFrench
          ? `Tout à fait d'accord. Contourner les standards d'ingénierie et empiler la dette a dégradé nos plateformes. Assainir les goulets d'étranglement maintenant va restaurer notre résilience et assainir durablement le socle.`
          : `Spot on. Bypassing standards has cost us dearly in uptime. Tackling the core bottlenecks now will stabilize the telemetry and unlock real agility.`;
      } else if (hasOpsCare) {
        trustDelta = -5;
        verdict = 'CONDITIONAL_ACCEPTANCE';
        rationale = isFrench ? 'Alerte sur le risque de bricoler l\'opérationnel au détriment du socle structurel.' : 'Warns against patching operations while neglecting foundational architecture.';
        responseDialogue = isFrench
          ? `Séparer l'opérationnel du socle structurel est un leurre qui nous a menés à la crise actuelle. Nous devons concevoir des composants découplés et robustes si nous voulons que le run tienne le choc.`
          : `Isolating operational firefighting from structural architecture is what got us into this mess. We must build decoupled, resilient patterns so operations stop bleeding.`;
        concessionRequired = isFrench ? 'Intégrer des barrières d\'architecture automatisées dans le CI/CD.' : 'Mandate automated architectural gate checks on pull requests.';
      } else {
        trustDelta = -9;
        verdict = 'REJECTED';
        rationale = isFrench ? 'Alerte sur le risque d\'accumulation de dette technique critique.' : 'Warns of catastrophic technical debt accumulation.';
        responseDialogue = isFrench
          ? `Prendre des raccourcis techniques ici va faire exploser la dette et effondrer nos services au prochain pic de charge. Je refuse de transiger sur l'isolation et la robustesse de l'architecture.`
          : `Taking shortcuts here will brick our core services under load. We cannot compromise on decouple-and-isolate patterns.`;
        concessionRequired = isFrench ? 'Imposer des revues d\'architecture strictes sur chaque brique critique.' : 'Mandate automated architectural gate checks on pull requests.';
      }
    } else if (roleLower.includes('sourcing') || roleLower.includes('esn') || roleLower.includes('prestataire') || roleLower.includes('offshore')) {
      if (hasSourcingCare || hasCollaboration) {
        trustDelta = +10;
        verdict = 'ACCEPTED';
        rationale = isFrench ? 'Clarté contractuelle et respect des engagements partenariaux.' : 'Contractual clarity and partnership commitment.';
        responseDialogue = isFrench
          ? `Nous avons besoin de clarté contractuelle et de visibilité sur les charges des équipes distantes. Si votre plan préserve les volumes convenus et le cadre de collaboration, nous vous accompagnons.`
          : `We need contractual clarity and predictability for our delivery teams. If your plan preserves the volume commitments and collaborative frame, we are aligned.`;
      } else {
        trustDelta = -6;
        verdict = 'CONDITIONAL_ACCEPTANCE';
        rationale = isFrench ? 'Inquiétude sur les pénalités contractuelles et la démobilisation des équipes.' : 'Concerned about delivery penalties and team turnover.';
        responseDialogue = isFrench
          ? `Modifier l'organisation sans concertation contractuelle risque de provoquer des pénalités et une démobilisation des ressources clés. Donnez-nous de la visibilité sur vos exigences.`
          : `Restructuring delivery teams without contractual visibility creates turnover and delivery penalties. Provide clear roadmap commitments.`;
        concessionRequired = isFrench ? 'Garantir le maintien du volume contractuel sur les prochains trimestres.' : 'Guarantee maintenance contract volume over the next quarters.';
      }
    } else if (roleLower.includes('ciso') || roleLower.includes('sécurité') || roleLower.includes('security') || roleLower.includes('conformité')) {
      if (hasSecurityCare) {
        trustDelta = +12;
        verdict = 'ACCEPTED';
        rationale = isFrench ? 'Conformité réglementaire et contrôle des accès validés.' : 'Regulatory compliance and access control validated.';
        responseDialogue = isFrench
          ? `La protection des données et la conformité aux exigences réglementaires ne sont pas négociables. Votre approche répond à nos standards de sécurité et d'audit, vous avez mon feu vert.`
          : `Data protection and regulatory compliance are non-negotiable. Your proposal addresses our security controls, you have my sign-off.`;
      } else {
        trustDelta = -8;
        verdict = 'REJECTED';
        rationale = isFrench ? 'Risque inacceptable d\'exposition réglementaire ou de fuite de données.' : 'Unacceptable risk of regulatory breach or data exposure.';
        responseDialogue = isFrench
          ? `Toute évolution sans contrôle d'accès strict ni journalisation d'audit expose l'entreprise à des sanctions réglementaires sévères. Je pose un véto tant que la sécurité n'est pas garantie.`
          : `Any change without strict access controls and audit logging exposes the firm to severe regulatory sanctions. I will block this until security controls are verified.`;
        concessionRequired = isFrench ? 'Mettre en place un audit de conformité et un chiffrement de bout en bout.' : 'Implement zero-trust logging and end-to-end encryption.';
      }
    } else {
      trustDelta = hasCollaboration ? +7 : -4;
      verdict = hasCollaboration ? 'ACCEPTED' : 'CONDITIONAL_ACCEPTANCE';
      rationale = isFrench ? 'Revue générale d\'alignement exécutif.' : 'General executive consensus review.';
      responseDialogue = isFrench
        ? `Je perçois votre volonté de compromis et de gouvernance collégiale. Tant que notre intégrité opérationnelle est préservée, nous pouvons avancer ensemble.`
        : `I see where you are heading with this strategy. As long as our operational integrity remains uncompromised, we can move forward.`;
    }

    return {
      responseDialogue,
      evaluation: {
        empathyScore: Math.min(100, Math.max(10, empathyScore)),
        financialAcumenScore: Math.min(100, Math.max(10, financialAcumenScore)),
        strategicAlignmentScore: Math.min(100, Math.max(10, strategicAlignmentScore)),
        trustDelta,
        verdict,
        rationale,
        concessionRequired,
      },
    };
  }

  public async generateScenario(prompt: ScenarioGenerationPrompt): Promise<Partial<Scenario>> {
    return FallbackProvider.createDynamicScenario(prompt);
  }

  public static createDynamicScenario(prompt: ScenarioGenerationPrompt): Scenario {
    const rawIndustry = (prompt.industry || 'Enterprise').trim();
    const rawChallenge = (prompt.businessChallenge || 'Core transformation under technical debt').trim();
    const fullText = `${rawIndustry}\n${rawChallenge}\n${prompt.customDirectives || ''}`;

    // --- 1. Intelligent Semantic Extraction ---
    // Extract Title if user provided structured format (e.g., "Titre du Scénario : ...")
    let scenarioTitle = '';
    const titleMatch = fullText.match(/(?:titre(?:\s+du\s+sc[ée]nario)?|title)\s*:\s*([^\n\r]+)/i);
    if (titleMatch && titleMatch[1].trim().length > 3) {
      scenarioTitle = titleMatch[1].trim().replace(/^["']|["']$/g, '');
    }

    // Extract Sector / Industry
    let extractedIndustry = rawIndustry;
    const industryMatch = fullText.match(/(?:secteur(?:\s+d['’]activit[ée])?|industry)\s*:\s*([^\n\r]+)/i);
    if (industryMatch && industryMatch[1].trim().length > 3) {
      extractedIndustry = industryMatch[1].trim().replace(/^["']|["']$/g, '');
    }

    // Detect Language
    const isFrench = /(?:sc[ée]nario|co[ûu]t|dette|d[ée]localisation|trimestre|souverainet[ée]|prestataire|assurance|r[ôo]le|entreprise|arbitrage|conflit|direction|gouvernance)/i.test(fullText);

    // Detect Theme: Offshore / Sourcing / Delocalization vs Core Banking / Cloud / Generic
    const isOffshore = /(?:offshore|onshore|d[ée]localisation|nearshore|esn|prestataire|sourcing|sous-trait|tma|outsourc|mirage\s+offshore)/i.test(fullText);

    if (!scenarioTitle) {
      if (isOffshore) {
        scenarioTitle = isFrench
          ? 'Mirage Offshore : Arbitrage Coûts, Souveraineté et Dette Technique'
          : 'Offshore Arbitrage: Cost Optimization, Sovereignty & Technical Debt';
      } else {
        const words = (rawIndustry + ' ' + rawChallenge).split(/\s+/).filter(w => w.length > 3 && !/^(with|from|that|this|under|facing|into|over|about)$/i.test(w));
        const domainKeyword = words[0] || 'Enterprise';
        const subDomain = words[1] || 'Systems';
        scenarioTitle = isFrench
          ? `${domainKeyword} ${subDomain} : Modernisation Stratégique de l'Architecture`
          : `${domainKeyword} ${subDomain}: Strategic Architecture Modernization`;
      }
    }

    // Extract Baseline Metrics if specified in prompt (e.g. TDI = 45, Vélocité = 55, etc.)
    let tdi = isOffshore ? 68 : 65;
    let velocity = isOffshore ? 48 : 50;
    let compliance = 65;
    let stakeholderTrust = 55;

    const tdiMatch = fullText.match(/(?:tdi|dette\s+technique|technical\s+debt)\s*[:=]?\s*(\d{1,3})/i);
    if (tdiMatch) tdi = Math.min(100, Math.max(10, parseInt(tdiMatch[1], 10)));

    const velMatch = fullText.match(/(?:v[ée]locit[ée]|velocity)\s*[:=]?\s*(\d{1,3})/i);
    if (velMatch) velocity = Math.min(100, Math.max(10, parseInt(velMatch[1], 10)));

    const compMatch = fullText.match(/(?:conformit[ée]|compliance)\s*[:=]?\s*(\d{1,3})/i);
    if (compMatch) compliance = Math.min(100, Math.max(10, parseInt(compMatch[1], 10)));

    const trustMatch = fullText.match(/(?:confiance|moral|trust)\s*[:=]?\s*(\d{1,3})/i);
    if (trustMatch) stakeholderTrust = Math.min(100, Math.max(10, parseInt(trustMatch[1], 10)));

    // Extract Difficulty
    let extractedDifficulty = prompt.difficulty || 'INTERMEDIATE';
    const diffMatch = fullText.match(/(?:niveau\s+de\s+difficult[ée]|difficulty)\s*:\s*([^\n\r]+)/i);
    if (diffMatch) {
      const d = diffMatch[1].toLowerCase();
      if (d.includes('élevé') || d.includes('high') || d.includes('expert') || d.includes('chief')) {
        extractedDifficulty = 'CRISIS_CHIEF';
      } else if (d.includes('moyen') || d.includes('interm')) {
        extractedDifficulty = 'INTERMEDIATE';
      } else if (d.includes('facile') || d.includes('entry') || d.includes('débutant')) {
        extractedDifficulty = 'ENTRY';
      }
    }

    let nodes: TopologyNode[] = [];
    let edges: TopologyEdge[] = [];
    let stakeholders: StakeholderPersona[] = [];
    let roundEvents: RoundEvent[] = [];
    let initiativesCatalog: InitiativeTemplate[] = [];

    // --- 2. THEME-SPECIFIC BLUEPRINT GENERATION ---
    if (isOffshore) {
      // 3D SPATIAL TOPOLOGY: ONSHORE (X < 0), BRIDGE/GOVERNANCE (X = 0), OFFSHORE (X > 0)
      nodes = [
        {
          id: 'node-onshore-portal',
          name: isFrench ? 'Portail Client & Canaux Digitaux (Onshore)' : 'Digital Channels & Customer Portal (Onshore)',
          layer: 'BUSINESS',
          description: isFrench
            ? 'Interfaces clients et canaux critiques gérés par les équipes internes onshore.'
            : 'Critical customer interfaces and digital channels maintained by onshore teams.',
          health: 78,
          technicalDebt: 32,
          criticalPath: true,
          costPerRound: 45,
          position: { x: -6, y: 5, z: -2 },
          status: 'HEALTHY',
          dependencies: ['node-onshore-core', 'node-bridge-gateway'],
          telemetry: { latencyMs: 45, throughputRps: 2200, errorRatePercent: 0.1, failureRisk: 15 },
        },
        {
          id: 'node-onshore-arch',
          name: isFrench ? 'Pôle Architecture & Équipes Internes' : 'Enterprise Architecture & Core Internal Squad',
          layer: 'BUSINESS',
          description: isFrench
            ? 'Direction technique garante des standards d\'architecture, de la documentation et du code souverain.'
            : 'Technical leadership ensuring architecture integrity, documentation, and sovereign codebase.',
          health: 60,
          technicalDebt: 45,
          criticalPath: true,
          costPerRound: 70,
          position: { x: -4, y: 6, z: 1 },
          status: 'DEGRADED',
          dependencies: ['node-onshore-core'],
          telemetry: { latencyMs: 20, throughputRps: 500, errorRatePercent: 0.05, failureRisk: 30 },
        },
        {
          id: 'node-onshore-core',
          name: isFrench ? 'Coeur Métier & Référentiel Souverain (Onshore)' : 'Sovereign Core Business Monolith (Onshore)',
          layer: 'APPLICATION',
          description: isFrench
            ? 'Socle applicatif souverain contenant les règles métier stratégiques, les contrats et les données sensibles.'
            : 'Core business application containing strategic business rules, contracts, and sensitive data.',
          health: 52,
          technicalDebt: tdi,
          criticalPath: true,
          costPerRound: 130,
          position: { x: -5, y: 1, z: 0 },
          status: 'DEGRADED',
          dependencies: ['node-onshore-db'],
          telemetry: { latencyMs: 380, throughputRps: 850, errorRatePercent: 2.1, failureRisk: 62 },
        },
        {
          id: 'node-onshore-db',
          name: isFrench ? 'Base de Données Souveraine & Données Clients' : 'Sovereign Customer Database & Vault',
          layer: 'DATA',
          description: isFrench
            ? 'Données bancaires et personnelles soumises aux exigences réglementaires strictes (RGPD/DORA).'
            : 'Customer data subject to strict regulatory compliance and residency mandates (GDPR/DORA).',
          health: 65,
          technicalDebt: 55,
          criticalPath: true,
          costPerRound: 95,
          position: { x: -4, y: -2, z: 1 },
          status: 'HEALTHY',
          dependencies: [],
          telemetry: { latencyMs: 120, throughputRps: 1800, errorRatePercent: 0.5, failureRisk: 38 },
        },
        {
          id: 'node-bridge-gateway',
          name: isFrench ? 'Passerelle API & Sas Transfrontalier' : 'Transborder API Gateway & Boundary Facade',
          layer: 'APPLICATION',
          description: isFrench
            ? 'Sas d\'isolation contractuelle et d\'authentification mTLS contrôlant les flux entre Onshore et Offshore.'
            : 'Contractual boundary and mTLS access gateway controlling traffic between Onshore and Offshore.',
          health: 75,
          technicalDebt: 28,
          criticalPath: true,
          costPerRound: 40,
          position: { x: 0, y: 2, z: 0 },
          status: 'HEALTHY',
          dependencies: ['node-onshore-core', 'node-offshore-delivery'],
          telemetry: { latencyMs: 25, throughputRps: 3200, errorRatePercent: 0.2, failureRisk: 20 },
        },
        {
          id: 'node-bridge-cicd',
          name: isFrench ? 'Quality Gates CI/CD & Contrôles Automatisés' : 'Automated CI/CD Quality Gates & Linter',
          layer: 'APPLICATION',
          description: isFrench
            ? 'Pipeline automatisé bloquant les pull requests avec duplication de code, dette technique ou failles CVE.'
            : 'Automated pipeline enforcing SonarQube quality gates, blocking non-compliant pull requests.',
          health: 70,
          technicalDebt: 30,
          criticalPath: true,
          costPerRound: 35,
          position: { x: 0, y: -2, z: 1 },
          status: 'HEALTHY',
          dependencies: ['node-bridge-infra'],
          telemetry: { latencyMs: 15, throughputRps: 4000, errorRatePercent: 0.05, failureRisk: 15 },
        },
        {
          id: 'node-bridge-infra',
          name: isFrench ? 'Liaison Réseau Sécurisée & VPN Dédié' : 'Dedicated Transborder VPN & Transit Mesh',
          layer: 'INFRASTRUCTURE',
          description: isFrench
            ? 'Tunnel chiffré transfrontalier reliant les infrastructures locales et le centre distant.'
            : 'Encrypted transborder network tunnel connecting on-premise infrastructure to remote offshore sites.',
          health: 80,
          technicalDebt: 20,
          criticalPath: false,
          costPerRound: 50,
          position: { x: 0, y: -6, z: 0 },
          status: 'HEALTHY',
          dependencies: [],
          telemetry: { latencyMs: 85, throughputRps: 6000, errorRatePercent: 0.1, failureRisk: 18 },
        },
        {
          id: 'node-offshore-delivery',
          name: isFrench ? 'Centre de Delivery Offshore (Partenaire ESN)' : 'Offshore Delivery Center (ESN Partner)',
          layer: 'APPLICATION',
          description: isFrench
            ? 'Pôle de développement externalisé en régie/forfait avec forte rotation d\'ingénieurs et décalage horaire.'
            : 'Externalized development center with high staff turnover, timezone offsets, and billing friction.',
          health: 45,
          technicalDebt: 72,
          criticalPath: true,
          costPerRound: 85,
          position: { x: 4, y: 2, z: 2 },
          status: 'CRITICAL',
          dependencies: ['node-offshore-factory'],
          telemetry: { latencyMs: 290, throughputRps: 650, errorRatePercent: 3.8, failureRisk: 75 },
        },
        {
          id: 'node-offshore-tma',
          name: isFrench ? 'Tierce Maintenance Applicative (TMA Offshore)' : 'Third-Party Application Maintenance (TMA)',
          layer: 'APPLICATION',
          description: isFrench
            ? 'Support N2/N3 et maintenance corrective confiés au prestataire distant, générant des avenants.'
            : 'L2/L3 support and legacy maintenance delegated to offshore provider, driving billable change requests.',
          health: 50,
          technicalDebt: 68,
          criticalPath: false,
          costPerRound: 65,
          position: { x: 6, y: 1, z: -1 },
          status: 'DEGRADED',
          dependencies: ['node-offshore-delivery'],
          telemetry: { latencyMs: 310, throughputRps: 420, errorRatePercent: 2.8, failureRisk: 65 },
        },
        {
          id: 'node-offshore-factory',
          name: isFrench ? 'Usine Logicielle Déportée & Cloud Sandbox' : 'Remote Software Factory & Cloud Sandbox',
          layer: 'INFRASTRUCTURE',
          description: isFrench
            ? 'Environnements de build et de test distants nécessitant un outillage robuste et des données anonymisées.'
            : 'Remote build and testing environments requiring robust isolation and anonymized datasets.',
          health: 60,
          technicalDebt: 50,
          criticalPath: false,
          costPerRound: 55,
          position: { x: 5, y: -5, z: 2 },
          status: 'DEGRADED',
          dependencies: ['node-bridge-infra'],
          telemetry: { latencyMs: 140, throughputRps: 2500, errorRatePercent: 1.2, failureRisk: 42 },
        },
      ];

      edges = [
        { id: 'edge-1', fromId: 'node-onshore-portal', toId: 'node-onshore-core', protocol: 'HTTPS/REST', bandwidthMbps: 1200, status: 'NORMAL', latencyMs: 25 },
        { id: 'edge-2', fromId: 'node-onshore-arch', toId: 'node-onshore-core', protocol: 'Governance/Review', bandwidthMbps: 500, status: 'BOTTLENECK', latencyMs: 180 },
        { id: 'edge-3', fromId: 'node-onshore-core', toId: 'node-onshore-db', protocol: 'JDBC Secure Pool', bandwidthMbps: 800, status: 'NORMAL', latencyMs: 40 },
        { id: 'edge-4', fromId: 'node-onshore-core', toId: 'node-bridge-gateway', protocol: 'mTLS gRPC', bandwidthMbps: 1500, status: 'NORMAL', latencyMs: 18 },
        { id: 'edge-5', fromId: 'node-bridge-gateway', toId: 'node-bridge-cicd', protocol: 'Webhook/Pipeline', bandwidthMbps: 1000, status: 'NORMAL', latencyMs: 12 },
        { id: 'edge-6', fromId: 'node-bridge-gateway', toId: 'node-offshore-delivery', protocol: 'Transborder REST', bandwidthMbps: 400, status: 'BOTTLENECK', latencyMs: 240 },
        { id: 'edge-7', fromId: 'node-offshore-delivery', toId: 'node-offshore-tma', protocol: 'Internal RPC', bandwidthMbps: 600, status: 'BOTTLENECK', latencyMs: 90 },
        { id: 'edge-8', fromId: 'node-offshore-delivery', toId: 'node-offshore-factory', protocol: 'Git/Docker Hub', bandwidthMbps: 1000, status: 'NORMAL', latencyMs: 80 },
        { id: 'edge-9', fromId: 'node-offshore-factory', toId: 'node-bridge-infra', protocol: 'IPSec Tunnel', bandwidthMbps: 800, status: 'NORMAL', latencyMs: 110 },
      ];

      stakeholders = [
        {
          id: 'sh-cfo',
          name: isFrench ? 'Jean-Christophe Meyer' : 'Marcus Sterling',
          title: isFrench ? 'Directeur Financier (CFO) - Coupeur de Coûts' : 'Chief Financial Officer (CFO)',
          role: isFrench ? 'Arbitrage Budgétaire & Pression sur les Coûts' : 'Corporate Finance & Cost Optimization',
          avatar: '💼',
          personality: isFrench
            ? 'Obsédé par les économies à court terme et le différentiel de TJM offshore. Refuse toute réinternalisation coûteuse.'
            : 'Relentlessly focused on short-term OpEx reduction and low offshore daily billing rates. Highly skeptical of domestic engineering costs.',
          bias: isFrench
            ? 'Considère le développement logiciel comme une commodité interchangeable qu\'il faut délocaliser au coût le plus bas.'
            : 'Views software engineering as a commoditized cost center that should be externalized to the lowest bidder.',
          hiddenAgenda: isFrench
            ? 'Son bonus annuel dépend directement d\'une baisse de 25% des coûts de delivery IT avant la clôture fiscale.'
            : 'Annual executive bonus is strictly contingent on achieving a 25% reduction in IT delivery costs.',
          negotiationTolerance: 45,
          baseTrust: stakeholderTrust,
          decisionWeights: { financialAcumen: 0.7, deliverySpeed: 0.1, architecturalRigor: 0.1, regulatoryCompliance: 0.1 },
          sampleDialogue: {
            greeting: isFrench
              ? 'Chaque développeur interne nous coûte trois fois plus cher qu\'en Inde ou au Maroc. Montrez-moi comment réduire la masse salariale locale.'
              : 'Every domestic developer costs triple an offshore resource. Show me how this initiative compresses our cash run-rate.',
            resistance: isFrench
              ? 'Réembaucher en France ? Hors de question. Pourquoi payer 800€/jour ce qu\'un prestataire distant me facture 220€ ?'
              : 'Rehire internally? Out of the question. Why pay €800/day domestically when an offshore partner bills €220?',
            concession: isFrench
              ? 'Si vous prouvez chiffres en main que les avenants contractuels et la dette coûtent plus cher que l\'économie faciale, je débloque un budget d\'outillage.'
              : 'If you can demonstrate with audited metrics that rework and vendor addenda exceed headline savings, I will release toolchain capex.',
          },
        },
        {
          id: 'sh-esn',
          name: isFrench ? 'Rajesh Patel' : 'Sanjay Patel',
          title: isFrench ? 'Directeur de Compte ESN Offshore' : 'Offshore Sourcing Account Executive',
          role: isFrench ? 'Partenaire Externalisation & Prestations TMA' : 'External Sourcing & TMA Account Management',
          avatar: '🤝',
          personality: isFrench
            ? 'Négociateur commercial redoutable, expert pour minimiser les dérives sous des avenants au forfait et survendre les capacités distantes.'
            : 'Astute vendor executive skilled in masking technical debt behind change requests and billing scope creep.',
          bias: isFrench
            ? 'Impute tous les retards et bugs à des spécifications imprécises fournies par les équipes onshore.'
            : 'Blames delivery regressions and defect leakage entirely on vague specifications from internal teams.',
          hiddenAgenda: isFrench
            ? 'Vendre le premier contrat à perte (loss leader) pour se rattraper massivement sur les avenants de maintenance et de refactorisation.'
            : 'Win initial contract on a loss-leader daily rate, then aggressively extract margin through paid change requests.',
          negotiationTolerance: 50,
          baseTrust: 55,
          decisionWeights: { financialAcumen: 0.4, deliverySpeed: 0.4, architecturalRigor: 0.1, regulatoryCompliance: 0.1 },
          sampleDialogue: {
            greeting: isFrench
              ? 'Nos 120 ingénieurs au centre de delivery sont prêts à accélérer vos sprints. Notre gouvernance est certifiée CMMI.'
              : 'Our offshore squads stand ready to absorb your backlog. Our delivery framework is certified CMMI level 5.',
            resistance: isFrench
              ? 'Ce correctif ne fait pas partie du périmètre initial. Cela nécessitera un avenant contractuel chiffré à 45 jours-hommes.'
              : 'This remediation falls outside the initial statement of work. It will require a formal change request for 45 man-days.',
            concession: isFrench
              ? 'Si vous fournissez des contrats d\'interface OpenAPI clairs et un pipeline CI/CD automatisé, nous accepterons des SLA stricts sur les défauts.'
              : 'If you establish clear OpenAPI contracts and automated CI/CD gates, we will accept contractual penalties on defect escape rates.',
          },
        },
        {
          id: 'sh-delivery-onshore',
          name: isFrench ? 'Sophie Chen' : 'Claire Vance',
          title: isFrench ? 'Delivery Manager & Lead Tech Onshore' : 'Onshore Delivery Manager & Lead Tech',
          role: isFrench ? 'Supervision Opérationnelle & Cohésion d\'Équipe' : 'Engineering Operations & Tech Lead',
          avatar: '⚡',
          personality: isFrench
            ? 'Épuisée, au bord du burnout. Coincée entre le gel des embauches du CFO et des revues de code interminables sur des livraisons offshore dégradées.'
            : 'Exhausted and battle-fatigued. Caught between the CFO hiring freeze and endless code reviews remediating defective offshore deliverables.',
          bias: isFrench
            ? 'Dénonce le mirage des coûts qui détruit le savoir-faire interne et dégrade la maintenabilité du socle.'
            : 'Believes wholesale offshore outsourcing is a reckless mirage that hollows out internal engineering competence.',
          hiddenAgenda: isFrench
            ? 'Son équipe d\'ingénieurs seniors menace d\'une démission collective si la charge de correction des bugs offshore ne diminue pas.'
            : 'Core senior engineering team has threatened mass resignation if unreviewed offshore pull requests continue to be forced through.',
          negotiationTolerance: 65,
          baseTrust: 60,
          decisionWeights: { financialAcumen: 0.1, deliverySpeed: 0.2, architecturalRigor: 0.6, regulatoryCompliance: 0.1 },
          sampleDialogue: {
            greeting: isFrench
              ? 'Mes développeurs passent 60% de leur temps à réécrire le code livré par le prestataire. On est au bord de l\'asphyxie.'
              : 'My engineers spend 60% of their sprints fixing regressions from the offshore repo. We are on the verge of total burnout.',
            resistance: isFrench
              ? 'On ne peut pas maintenir une architecture distribuée si la connaissance métier est éparpillée sans documentation ni tests.'
              : 'We cannot maintain systemic stability when domain logic is fractured across remote teams with zero documentation.',
            concession: isFrench
              ? 'Donnez-nous une architecture en sablier avec des Quality Gates automatiques qui rejettent les PR pourries, et on pourra tenir.'
              : 'Give us an hourglass boundary with automated quality gates that reject non-compliant PRs, and my team can survive.',
          },
        },
        {
          id: 'sh-ciso',
          name: isFrench ? 'Alexandre Mercier' : 'Arthur Pendelton',
          title: isFrench ? 'Directeur Cybersécurité & Conformité (CISO)' : 'Chief Information Security & Compliance Officer',
          role: isFrench ? 'Souveraineté des Données & Risque Réglementaire' : 'Data Sovereignty & Regulatory Compliance',
          avatar: '🛡️',
          personality: isFrench
            ? 'Vigilant, rigoureux, intransigeant sur l\'exposition des données de santé/bancaires hors UE et les risques d\'exfiltration.'
            : 'Vigilant and audit-conscious. Zero tolerance for unauthorized cross-border exposure of regulated customer data.',
          bias: isFrench
            ? 'Se méfie viscéralement des environnements de test déportés et des partages de code non audités.'
            : 'Deeply skeptical of remote developer access to staging environments holding masked customer data.',
          hiddenAgenda: isFrench
            ? 'Un audit de conformité DORA et RGPD est prévu au T3 ; toute non-conformité majeure engage sa responsabilité personnelle.'
            : 'Regulatory DORA/GDPR audit scheduled for Q3; any sovereign data leak puts his professional certification at risk.',
          negotiationTolerance: 40,
          baseTrust: compliance,
          decisionWeights: { financialAcumen: 0.1, deliverySpeed: 0.05, architecturalRigor: 0.25, regulatoryCompliance: 0.6 },
          sampleDialogue: {
            greeting: isFrench
              ? 'Délocaliser le code ne dispense pas de respecter la souveraineté. Avez-vous vérifié où transitent vos données de test ?'
              : 'Externalizing engineering does not exempt us from sovereignty laws. Where is staging data physically hosted?',
            resistance: isFrench
              ? 'Accorder des accès directs à la base client depuis un site offshore sans chiffrement ni masquage est un veto immédiat.'
              : 'Direct database access from offshore networks without synthetic masking is an instant regulatory breach.',
            concession: isFrench
              ? 'Mettez en place des données synthétiques et un sas zéro-trust automatisé, et je valide le cadre opérationnel.'
              : 'Enforce automated synthetic data generation and zero-trust perimeter proxies, and I will sign off on compliance.',
          },
        },
      ];

      roundEvents = [
        {
          roundNumber: 1,
          title: isFrench ? 'T1: Friction du Transfert de Connaissances & Chute de Vélocité' : 'Q1: Knowledge Transfer Bottlenecks & Velocity Slump',
          description: isFrench
            ? 'Le passage de relais vers le centre offshore est chaotique. Les équipes internes sont saturées de requêtes, les livraisons s\'enrayent et la vélocité chute de 25%.'
            : 'Knowledge transfer to the offshore partner is stumbling. Onshore engineers are inundated with support requests, and feature velocity drops 25%.',
          type: 'COMPETITIVE_SURGE',
          severity: 'HIGH',
          immediateImpact: { budgetFine: 40, tdiSurge: 6, velocityPenalty: -12 },
          choices: [
            {
              id: 'c1-paved-path',
              text: isFrench ? 'Imposer des contrats d\'interface stricts et un Paved Path (Délai initial, fondation pérenne)' : 'Mandate strict interface contracts and an automated Paved Path',
              capExImpact: 110,
              tdiImpact: -10,
              velocityImpact: -6,
              trustImpact: { 'sh-delivery-onshore': 14, 'sh-cfo': -8, 'sh-esn': 6 },
            },
            {
              id: 'c1-blind-approval',
              text: isFrench ? 'Accélérer les approbations de PR sans revue approfondie pour tenir les délais du CFO (Dette massive)' : 'Rubber-stamp offshore PRs to satisfy CFO sprint deadlines (Massive technical debt)',
              capExImpact: 30,
              tdiImpact: 16,
              velocityImpact: 14,
              trustImpact: { 'sh-cfo': 12, 'sh-delivery-onshore': -18, 'sh-ciso': -10 },
            },
            {
              id: 'c1-manual-onshore-strain',
              text: isFrench ? 'Obliger l\'équipe interne à réviser manuellement 100% du code distant (Épuisement, blocage des livraisons)' : 'Force onshore team to manually inspect every line of remote code (Burnout, stalled pipeline)',
              capExImpact: 60,
              tdiImpact: -2,
              velocityImpact: -16,
              trustImpact: { 'sh-delivery-onshore': -12, 'sh-cfo': -6 },
            },
          ],
        },
        {
          roundNumber: 2,
          title: isFrench ? 'T2: Incident de Fuite de Données Transfrontalière & Alerte Souveraineté' : 'Q2: Cross-Border Staging Leak & Sovereignty Crisis',
          description: isFrench
            ? 'Un dump de données réelles non anonymisées a été synchronisé sur un serveur de test offshore accessible sans double authentification. Le RSSI déclenche l\'alerte rouge.'
            : 'An unmasked database dump was synced to an unsecured offshore staging server. Regulators and cybersecurity issue a critical compliance warning.',
          type: 'AUDIT',
          severity: 'HIGH',
          immediateImpact: { budgetFine: 140, tdiSurge: 2, velocityPenalty: -10 },
          choices: [
            {
              id: 'c2-synthetic-isolation',
              text: isFrench ? 'Déployer d\'urgence un moteur de données synthétiques et couper les accès aux bases réelles' : 'Deploy automated synthetic data masking and sever raw staging db access',
              capExImpact: 130,
              tdiImpact: -6,
              velocityImpact: -8,
              trustImpact: { 'sh-ciso': 22, 'sh-delivery-onshore': 8, 'sh-cfo': -10 },
            },
            {
              id: 'c2-selective-patch',
              text: isFrench ? 'Appliquer un patch périmétrique sur le VPN et signer un accord de confidentialité renforcé avec l\'ESN' : 'Apply basic firewall patch and sign non-disclosure addendum with partner',
              capExImpact: 50,
              tdiImpact: 4,
              velocityImpact: 2,
              trustImpact: { 'sh-ciso': -12, 'sh-cfo': 8, 'sh-esn': 10 },
            },
            {
              id: 'c2-full-stop',
              text: isFrench ? 'Geler toutes les livraisons offshore pendant un mois pour audit forensique exhaustif' : 'Impose full 30-day freeze on remote delivery for comprehensive forensic audit',
              capExImpact: 180,
              tdiImpact: -8,
              velocityImpact: -22,
              trustImpact: { 'sh-ciso': 20, 'sh-cfo': -20, 'sh-esn': -15 },
            },
          ],
        },
        {
          roundNumber: 3,
          title: isFrench ? 'T3: Mur de la Dette Technique & Explosion des Avenants ESN' : 'Q3: Technical Debt Wall & Runaway Vendor Addenda',
          description: isFrench
            ? 'Le coeur applicatif se dégrade : multiplication des bugs récurrents et tests désactivés. L\'ESN refuse d\'assumer et réclame un avenant de 180K€ pour corriger les régressions.'
            : 'Accumulated technical debt triggers recurring production crashes. The offshore vendor disclaims liability and presents a massive change request invoice.',
          type: 'CRISIS',
          severity: 'BLACK_SWAN',
          immediateImpact: { budgetFine: 220, tdiSurge: 10, velocityPenalty: -15, downedNodeIds: ['node-onshore-core', 'node-offshore-delivery'] },
          choices: [
            {
              id: 'c3-reinternalize-core',
              text: isFrench ? 'Réinternaliser les briques critiques du Core avec une squad interne commando et Quality Gates bloquantes' : 'Reinternalize strategic core modules with dedicated onshore squad and blocking quality gates',
              capExImpact: 190,
              tdiImpact: -18,
              velocityImpact: 10,
              trustImpact: { 'sh-delivery-onshore': 20, 'sh-cfo': -12, 'sh-esn': -16 },
            },
            {
              id: 'c3-pay-addendum',
              text: isFrench ? 'Payer l\'avenant à l\'ESN pour préserver la date de livraison promise au Conseil d\'Administration' : 'Pay the vendor addendum to protect executive delivery deadlines at all costs',
              capExImpact: 240,
              tdiImpact: 8,
              velocityImpact: 6,
              trustImpact: { 'sh-esn': 18, 'sh-cfo': -14, 'sh-delivery-onshore': -18 },
            },
            {
              id: 'c3-dispute-freeze',
              text: isFrench ? 'Engager un contentieux contractuel avec gel des paiements et blocage des développements' : 'Initiate formal contractual dispute, freezing vendor invoices and halting releases',
              capExImpact: 90,
              tdiImpact: 0,
              velocityImpact: -20,
              trustImpact: { 'sh-cfo': 6, 'sh-esn': -25, 'sh-delivery-onshore': -8 },
            },
          ],
        },
        {
          roundNumber: 4,
          title: isFrench ? 'T4: Arbitrage Final du Board : Modèle Cible de Sourcing & Bilan TCO' : 'Q4: Board Arbitrage: Target Sourcing Architecture & TCO Verdict',
          description: isFrench
            ? 'Dénouement de la simulation. Le Conseil d\'Administration tranche entre mirage des coûts faciaux et résilience de la souveraineté technologique.'
            : 'Final simulation review. The Board of Directors weighs headline vendor savings against architectural sovereignty and real TCO.',
          type: 'MARKET_SHIFT',
          severity: 'HIGH',
          immediateImpact: { budgetFine: 0, tdiSurge: 0, velocityPenalty: 0 },
          choices: [
            {
              id: 'c4-hourglass-hybrid',
              text: isFrench ? 'Adopter le Modèle Cible Hybride (Core interne souverain + Partenariat Nearshore outillé sur API strictes)' : 'Adopt Hourglass Hybrid Model: Sovereign internal core paired with disciplined nearshore API partners',
              capExImpact: 120,
              tdiImpact: -12,
              velocityImpact: 14,
              trustImpact: { 'sh-cfo': 12, 'sh-delivery-onshore': 14, 'sh-ciso': 12 },
            },
            {
              id: 'c4-full-insource',
              text: isFrench ? 'Rapatriement intégral Onshore (Suppression de l\'offshore, hausse des charges fixes internes)' : 'Full onshore insourcing: Eliminate offshore footprint and rebuild internal engineering bench',
              capExImpact: 260,
              tdiImpact: -20,
              velocityImpact: 8,
              trustImpact: { 'sh-delivery-onshore': 22, 'sh-cfo': -22, 'sh-ciso': 15 },
            },
            {
              id: 'c4-double-down-offshore',
              text: isFrench ? 'Externalisation maximale (Poursuivre la délocalisation massive en acceptant la dette comme coût d\'affaires)' : 'Double-down on offshore outsourcing, treating technical debt as acceptable cost of business',
              capExImpact: -60,
              tdiImpact: 18,
              velocityImpact: -12,
              trustImpact: { 'sh-cfo': 20, 'sh-delivery-onshore': -25, 'sh-ciso': -18 },
            },
          ],
        },
      ];

      initiativesCatalog = [
        {
          id: 'init-paved-path',
          name: isFrench ? 'Architecture en Sablier (Hourglass) & Paved Path Souverain' : 'Hourglass Architecture & Sovereign Paved Path',
          category: 'MODERNIZATION',
          description: isFrench
            ? 'Isoler le coeur métier stratégique derrière des façades API contractuelles strictes, limitant le périmètre confié aux équipes distantes.'
            : 'Encapsulate sovereign domain logic behind strict API facades, creating an anti-corruption boundary for remote teams.',
          capExCost: 280,
          opExDelta: -30,
          tdiDelta: -20,
          velocityDelta: 16,
          resilienceDelta: 18,
          complianceDelta: 14,
          trustDelta: { 'sh-delivery-onshore': 16, 'sh-ciso': 12, 'sh-cfo': -6 },
          affectedNodeIds: ['node-onshore-core', 'node-bridge-gateway'],
          durationRounds: 1,
          riskLevel: 'MEDIUM',
        },
        {
          id: 'init-cicd-quality',
          name: isFrench ? 'Quality Gates CI/CD & Pipeline Bloquant (SonarQube/Linter)' : 'Automated Quality Gates & Blocking CI/CD Pipeline',
          category: 'SECURITY_COMPLIANCE',
          description: isFrench
            ? 'Rejet automatisé des pull requests ne respectant pas les critères de couverture de tests, de duplication ou de sécurité CVE.'
            : 'Automated verification pipeline that mechanically rejects code containing security flaws or excessive technical debt.',
          capExCost: 190,
          opExDelta: -15,
          tdiDelta: -16,
          velocityDelta: -4,
          resilienceDelta: 20,
          complianceDelta: 22,
          trustDelta: { 'sh-delivery-onshore': 18, 'sh-ciso': 16, 'sh-esn': -10 },
          affectedNodeIds: ['node-bridge-cicd', 'node-offshore-delivery'],
          durationRounds: 1,
          riskLevel: 'LOW',
        },
        {
          id: 'init-synthetic-data',
          name: isFrench ? 'Données Synthétiques & Sandbox Déportée Anti-Fuite' : 'Synthetic Data Generation & Isolated Test Sandbox',
          category: 'SECURITY_COMPLIANCE',
          description: isFrench
            ? 'Génération automatisée de jeux de données réalistes mais anonymisés, supprimant tout transit de données réelles vers l\'offshore.'
            : 'Automated generation of synthetic test datasets, eliminating cross-border transmission of raw customer records.',
          capExCost: 160,
          opExDelta: -10,
          tdiDelta: -8,
          velocityDelta: 10,
          resilienceDelta: 14,
          complianceDelta: 28,
          trustDelta: { 'sh-ciso': 24, 'sh-cfo': 6 },
          affectedNodeIds: ['node-onshore-db', 'node-offshore-factory'],
          durationRounds: 1,
          riskLevel: 'LOW',
        },
        {
          id: 'init-core-reinternalize',
          name: isFrench ? 'Réinternalisation Agile du Coeur Métier (Insourcing Squad)' : 'Agile Core Reinternalization (Strategic Insourcing)',
          category: 'MODERNIZATION',
          description: isFrench
            ? 'Rapatrier le développement des modules à forte valeur ajoutée au sein d\'une squad interne d\'élite pour restaurer la maîtrise technique.'
            : 'Repatriate strategic software components to an elite onshore squad to re-establish internal architectural mastery.',
          capExCost: 340,
          opExDelta: 20,
          tdiDelta: -24,
          velocityDelta: 18,
          resilienceDelta: 24,
          complianceDelta: 16,
          trustDelta: { 'sh-delivery-onshore': 22, 'sh-cfo': -16, 'sh-esn': -20 },
          affectedNodeIds: ['node-onshore-core', 'node-onshore-arch'],
          durationRounds: 1,
          riskLevel: 'HIGH',
        },
        {
          id: 'init-nearshore-hybrid',
          name: isFrench ? 'Modèle Hybride Nearshore & Co-Développement Agile' : 'Nearshore Hybrid Delivery & Agile Co-Development',
          category: 'MODERNIZATION',
          description: isFrench
            ? 'Remplacer l\'usine offshore distante à fort turnover par un centre nearshore sur le même fuseau horaire, intégré aux cérémonies agiles.'
            : 'Replace distant high-turnover offshore teams with aligned nearshore engineers sharing timezones and agile rituals.',
          capExCost: 240,
          opExDelta: -25,
          tdiDelta: -12,
          velocityDelta: 14,
          resilienceDelta: 15,
          complianceDelta: 10,
          trustDelta: { 'sh-delivery-onshore': 10, 'sh-cfo': 8, 'sh-esn': 12 },
          affectedNodeIds: ['node-offshore-delivery', 'node-bridge-gateway'],
          durationRounds: 1,
          riskLevel: 'MEDIUM',
        },
        {
          id: 'init-outcome-contract',
          name: isFrench ? 'Refonte Contractuelle au Forfait & Engagement sur SLA Qualité' : 'Outcome-Based Contract Restructuring & Quality SLAs',
          category: 'FEATURE_EXPEDITE',
          description: isFrench
            ? 'Remplacer la facturation en régie au TJM par un contrat indexé sur la stabilité en production, le taux de reprise et le respect des standards.'
            : 'Shift vendor commercial terms from hourly billing to outcome-based contracts tied to production stability and defect rates.',
          capExCost: 120,
          opExDelta: -35,
          tdiDelta: -10,
          velocityDelta: 8,
          resilienceDelta: 12,
          complianceDelta: 8,
          trustDelta: { 'sh-cfo': 18, 'sh-esn': -12, 'sh-delivery-onshore': 12 },
          affectedNodeIds: ['node-offshore-tma', 'node-onshore-arch'],
          durationRounds: 1,
          riskLevel: 'LOW',
        },
      ];
    } else {
      // --- GENERIC / DOMAIN SPECIFIC BLUEPRINT ---
      const words = (extractedIndustry + ' ' + rawChallenge).split(/\s+/).filter(w => w.length > 3 && !/^(with|from|that|this|under|facing|into|over|about)$/i.test(w));
      const domainKeyword = words[0] || 'Enterprise';
      const subDomain = words[1] || 'Services';
      const entityName = `${domainKeyword} ${subDomain}`;

      const isBanking = /bank|fintech|pay|clearing|settlement|treasury/i.test(extractedIndustry + ' ' + rawChallenge);
      const isHealthcare = /health|med|clinic|patient|hospital|ehr|hipaa/i.test(extractedIndustry + ' ' + rawChallenge);

      const clientTouchpointName = isFrench
        ? `Portail Client & Services Numériques (${entityName})`
        : isBanking
        ? `${domainKeyword} Corporate Banking Portal`
        : isHealthcare
        ? `${domainKeyword} Clinical Care Portal`
        : `${entityName} Omnichannel Customer Hub`;

      const coreMonolithName = isFrench
        ? `Coeur Applicatif Central & Monolithe Métier (${domainKeyword})`
        : isBanking
        ? `${domainKeyword} Mainframe Core Settlement Monolith`
        : isHealthcare
        ? `${domainKeyword} Legacy EHR Core Monolith`
        : `${entityName} Core Processing Monolith`;

      nodes = [
        {
          id: 'node-biz-1',
          name: clientTouchpointName,
          layer: 'BUSINESS',
          description: isFrench ? `Interfaces clients et partenaires de ${entityName}.` : `Customer and partner digital interface for ${entityName}.`,
          health: 75,
          technicalDebt: 35,
          criticalPath: true,
          costPerRound: 45,
          position: { x: -6, y: 6, z: -2 },
          status: 'HEALTHY',
          dependencies: ['node-app-1', 'node-app-2'],
          telemetry: { latencyMs: 85, throughputRps: 1850, errorRatePercent: 0.2, failureRisk: 22 },
        },
        {
          id: 'node-biz-2',
          name: isFrench ? `Hub Opérations & Métier (${entityName})` : `${entityName} Operations & Settlement Hub`,
          layer: 'BUSINESS',
          description: isFrench ? `Capacités métier critiques et opérations transactionnelles.` : `Core operational business capabilities driving revenue.`,
          health: 55,
          technicalDebt: 65,
          criticalPath: true,
          costPerRound: 80,
          position: { x: 4, y: 6, z: 2 },
          status: 'DEGRADED',
          dependencies: ['node-app-2', 'node-data-1'],
          telemetry: { latencyMs: 240, throughputRps: 620, errorRatePercent: 1.8, failureRisk: 58 },
        },
        {
          id: 'node-app-1',
          name: isFrench ? `Passerelle API & Gestion des Accès` : `${domainKeyword} Omnichannel API Gateway`,
          layer: 'APPLICATION',
          description: isFrench ? 'Sécurité périmétrique, routage intelligent et gestion des tokens d\'accès.' : 'Edge security, rate limiting, and identity token orchestration.',
          health: 80,
          technicalDebt: 25,
          criticalPath: true,
          costPerRound: 35,
          position: { x: -5, y: 2, z: -1 },
          status: 'HEALTHY',
          dependencies: ['node-app-2', 'node-app-3'],
          telemetry: { latencyMs: 18, throughputRps: 3400, errorRatePercent: 0.05, failureRisk: 12 },
        },
        {
          id: 'node-app-2',
          name: coreMonolithName,
          layer: 'APPLICATION',
          description: isFrench ? `Monolithe legacy critique. Fort couplage et dette technique élevée.` : `Mission-critical legacy monolith. Tightly coupled, fragile bottleneck.`,
          health: 42,
          technicalDebt: tdi,
          criticalPath: true,
          costPerRound: 140,
          position: { x: 0, y: 2, z: 0 },
          status: 'CRITICAL',
          dependencies: ['node-data-1', 'node-infra-1'],
          telemetry: { latencyMs: 640, throughputRps: 450, errorRatePercent: 3.4, failureRisk: 82 },
        },
        {
          id: 'node-app-3',
          name: isFrench ? `Maillage Microservices & Événements` : `${domainKeyword} Modern Microservices Mesh`,
          layer: 'APPLICATION',
          description: isFrench ? 'Services conteneurisés pilotés par les événements et workflows découplés.' : 'Containerized event-driven services handling modular workflows.',
          health: 88,
          technicalDebt: 18,
          criticalPath: false,
          costPerRound: 50,
          position: { x: 5, y: 2, z: -2 },
          status: 'HEALTHY',
          dependencies: ['node-data-2', 'node-infra-2'],
          telemetry: { latencyMs: 32, throughputRps: 1900, errorRatePercent: 0.1, failureRisk: 14 },
        },
        {
          id: 'node-data-1',
          name: isFrench ? 'Base de Données Relationnelle Legacy' : 'Legacy Relational Database Cluster',
          layer: 'DATA',
          description: isFrench ? 'Point de défaillance unique soumis à des verrous et saturations I/O.' : 'Single-point-of-failure shared relational database suffering from lock contention.',
          health: 48,
          technicalDebt: 72,
          criticalPath: true,
          costPerRound: 95,
          position: { x: -3, y: -2, z: 1 },
          status: 'DEGRADED',
          dependencies: ['node-infra-1'],
          telemetry: { latencyMs: 380, throughputRps: 920, errorRatePercent: 2.1, failureRisk: 66 },
        },
        {
          id: 'node-data-2',
          name: isFrench ? 'Flux d\'Événements Distribué (Kafka)' : 'Distributed Kafka Event Stream',
          layer: 'DATA',
          description: isFrench ? 'Journal d\'événements haute disponibilité découplant producteurs et consommateurs.' : 'High-throughput append-only log decoupling event producers from consumers.',
          health: 92,
          technicalDebt: 12,
          criticalPath: false,
          costPerRound: 40,
          position: { x: 4, y: -2, z: -1 },
          status: 'MODERNIZED',
          dependencies: ['node-infra-2'],
          telemetry: { latencyMs: 12, throughputRps: 7500, errorRatePercent: 0.01, failureRisk: 8 },
        },
        {
          id: 'node-infra-1',
          name: isFrench ? 'Datacenter Privé & Serveurs Locaux' : 'On-Premise Private Datacenter',
          layer: 'INFRASTRUCTURE',
          description: isFrench ? 'Infrastructure matérielle vieillissante arrivant à saturation contractuelle.' : 'Aging bare-metal infrastructure nearing end-of-life contract renewals.',
          health: 52,
          technicalDebt: 68,
          criticalPath: true,
          costPerRound: 110,
          position: { x: -2, y: -6, z: 2 },
          status: 'DEGRADED',
          dependencies: [],
          telemetry: { latencyMs: 110, throughputRps: 4500, errorRatePercent: 1.2, failureRisk: 55 },
        },
        {
          id: 'node-infra-2',
          name: isFrench ? 'Plateforme Cloud Hybride & Kubernetes' : 'Multi-Region Kubernetes Cloud Mesh',
          layer: 'INFRASTRUCTURE',
          description: isFrench ? 'Infrastructure cloud élastique avec déploiements automatisés et bascule multi-zone.' : 'Elastic cloud footprint with automated autoscaling and multi-zone failover.',
          health: 90,
          technicalDebt: 15,
          criticalPath: false,
          costPerRound: 65,
          position: { x: 3, y: -6, z: -2 },
          status: 'MODERNIZED',
          dependencies: [],
          telemetry: { latencyMs: 24, throughputRps: 8200, errorRatePercent: 0.02, failureRisk: 10 },
        },
      ];

      edges = [
        { id: 'edge-1', fromId: 'node-biz-1', toId: 'node-app-1', protocol: 'HTTPS/gRPC', bandwidthMbps: 1000, status: 'NORMAL', latencyMs: 15 },
        { id: 'edge-2', fromId: 'node-biz-2', toId: 'node-app-2', protocol: 'SOAP/REST', bandwidthMbps: 450, status: 'BOTTLENECK', latencyMs: 310 },
        { id: 'edge-3', fromId: 'node-app-1', toId: 'node-app-2', protocol: 'Internal RPC', bandwidthMbps: 300, status: 'BOTTLENECK', latencyMs: 280 },
        { id: 'edge-4', fromId: 'node-app-1', toId: 'node-app-3', protocol: 'mTLS HTTP/2', bandwidthMbps: 2000, status: 'OPTIMIZED', latencyMs: 12 },
        { id: 'edge-5', fromId: 'node-app-2', toId: 'node-data-1', protocol: 'JDBC Direct Pool', bandwidthMbps: 500, status: 'BOTTLENECK', latencyMs: 420 },
        { id: 'edge-6', fromId: 'node-app-3', toId: 'node-data-2', protocol: 'Kafka Protocol', bandwidthMbps: 5000, status: 'OPTIMIZED', latencyMs: 8 },
        { id: 'edge-7', fromId: 'node-data-1', toId: 'node-infra-1', protocol: 'Fibre Channel SAN', bandwidthMbps: 800, status: 'NORMAL', latencyMs: 45 },
        { id: 'edge-8', fromId: 'node-data-2', toId: 'node-infra-2', protocol: 'Cloud VPC Peering', bandwidthMbps: 10000, status: 'OPTIMIZED', latencyMs: 4 },
      ];

      stakeholders = [
        {
          id: 'sh-cfo',
          name: isFrench ? 'Jean-Christophe Meyer' : 'Marcus Sterling',
          title: isFrench ? 'Directeur Financier (CFO)' : 'Chief Financial Officer',
          role: isFrench ? 'Finances & Allocation du Capital' : 'Corporate Finance & Capital Allocation',
          avatar: '💼',
          personality: isFrench
            ? 'Prudent, axé sur les chiffres, exige un retour sur investissement rapide sur chaque euro engagé.'
            : 'Conservative, data-driven, relentlessly interrogates ROI and ongoing OpEx run-rate.',
          bias: isFrench ? 'Privilégie les réductions immédiates de coûts de maintenance.' : 'Believes technology investments must prove payback within 3 quarters.',
          hiddenAgenda: isFrench ? 'Prépare une revue financière annuelle et ne tolère aucun dérapage budgétaire.' : 'Preparing corporate books for credit review; cannot tolerate margin erosion.',
          negotiationTolerance: 55,
          baseTrust: stakeholderTrust,
          decisionWeights: { financialAcumen: 0.65, deliverySpeed: 0.1, architecturalRigor: 0.15, regulatoryCompliance: 0.1 },
          sampleDialogue: {
            greeting: isFrench ? 'Soyons concis. Quel est le coût et où sont les économies mesurables ?' : 'Keep it brief. Every dollar invested comes directly out of earnings.',
            resistance: isFrench ? 'Le devis CapEx est excessif et sans économie garantie.' : 'I see massive CapEx and zero guaranteed savings.',
            concession: isFrench ? 'Si vous réduisez l\'OpEx récurrent de 15%, je valide la tranche suivante.' : 'Demonstrate clear OpEx reduction, and I will unlock funding.',
          },
        },
        {
          id: 'sh-cpo',
          name: isFrench ? 'Camille Laurent' : 'Priya Sharma',
          title: isFrench ? 'Directrice Produit & Croissance (CPO)' : 'VP of Product & Growth',
          role: isFrench ? 'Vélocité Marché & Satisfaction Client' : 'Customer Acquisition & Market Velocity',
          avatar: '🚀',
          personality: isFrench
            ? 'Dynamique, impatiente, veut livrer des fonctionnalités avant les concurrents.'
            : 'Charismatic, impatient, obsessed with out-innovating agile competitors.',
          bias: isFrench ? 'Considère les revues d\'architecture comme des freins bureaucratiques.' : 'Views architectural governance as velocity-killing bottlenecks.',
          hiddenAgenda: isFrench ? 'Rémunération indexée sur le lancement des nouvelles offres d\'ici le T3.' : 'Bonus tied to customer-facing launches by Q3.',
          negotiationTolerance: 45,
          baseTrust: velocity,
          decisionWeights: { financialAcumen: 0.1, deliverySpeed: 0.65, architecturalRigor: 0.1, regulatoryCompliance: 0.15 },
          sampleDialogue: {
            greeting: isFrench ? 'Les utilisateurs veulent des fonctionnalités, pas des schémas d\'architecture.' : 'Our users care about instant feature execution.',
            resistance: isFrench ? 'Geler les développements pour refactoriser nous fera perdre nos clients.' : 'Freezing feature development will lose us market share.',
            concession: isFrench ? 'Si vous isolez le monolithe pour que mon équipe livre sans dépendance, je vous soutiens.' : 'Isolate the changes so teams deploy autonomously and I am on board.',
          },
        },
        {
          id: 'sh-cto',
          name: isFrench ? 'Dr. Éléonore Rostand' : 'Dr. Elena Rostova',
          title: isFrench ? 'Directrice de l\'Architecture d\'Entreprise' : 'Chief Enterprise Architect',
          role: isFrench ? 'Gouvernance Technique & Intégrité Système' : 'Architecture Integrity & Technical Governance',
          avatar: '🛡️',
          personality: isFrench
            ? 'Analytique, visionnaire, intransigeante sur la dette technique et la résilience.'
            : 'Analytical, battle-hardened veteran prioritizing systemic resilience and technical debt remediation.',
          bias: isFrench ? 'Rejette les raccourcis temporaires qui deviennent des dettes permanentes.' : 'Prioritizes loose coupling and sustainability over quick fixes.',
          hiddenAgenda: isFrench ? 'Éliminer la dépendance aux technologies propriétaires vieillissantes.' : 'Wants to phase out legacy vendor lock-in and adopt open standards.',
          negotiationTolerance: 65,
          baseTrust: 65,
          decisionWeights: { financialAcumen: 0.15, deliverySpeed: 0.15, architecturalRigor: 0.55, regulatoryCompliance: 0.15 },
          sampleDialogue: {
            greeting: isFrench ? 'Chaque compromis d\'architecture non maîtrisé se paie au centuple plus tard.' : 'Architectural shortcuts compound into insurmountable enterprise debt.',
            resistance: isFrench ? 'Contourner les règles de migration corrompra les données sous forte charge.' : 'Bypassing schema migrations will cause cascading data corruption.',
            concession: isFrench ? 'Mettez en place des tests de contrat automatisés et j\'approuve le calendrier.' : 'Mandate automated contract testing, and I will approve the schedule.',
          },
        },
        {
          id: 'sh-cso',
          name: isFrench ? 'Marc Delangle' : 'Arthur Pendelton',
          title: isFrench ? 'Directeur Sécurité & Conformité Réglementaire' : 'Chief Compliance & Risk Officer',
          avatar: '⚖️',
          role: isFrench ? 'Conformité Réglementaire & Cyber-Résilience' : 'Regulatory Governance & Cyber Resilience',
          personality: isFrench ? 'Rigide, vigilant, soucieux des audits et des sanctions légales.' : 'Strict, audit-conscious, vigilant against regulatory sanctions.',
          bias: isFrench ? 'Tolérance zéro sur les failles de données et les dépendances tierces non vérifiées.' : 'Zero tolerance for unverified dependencies or unaudited shadow IT.',
          hiddenAgenda: isFrench ? 'Audit d\'autorité de contrôle programmé dans les prochains mois.' : 'Under pressure from regulators following industry audits.',
          negotiationTolerance: 40,
          baseTrust: compliance,
          decisionWeights: { financialAcumen: 0.1, deliverySpeed: 0.05, architecturalRigor: 0.25, regulatoryCompliance: 0.6 },
          sampleDialogue: {
            greeting: isFrench ? 'Une seule amende réglementaire efface tous vos gains de fonctionnalités.' : 'A single regulatory fine wipes out your entire year of gains.',
            resistance: isFrench ? 'Ce composant ne respecte pas les exigences de traçabilité et de chiffrement.' : 'This architecture lacks end-to-end auditability and encryption.',
            concession: isFrench ? 'Ajoutez un audit trail automatisé et mTLS, et je valide le passage en production.' : 'Implement mTLS and immutable audit logs for compliance clearance.',
          },
        },
      ];

      roundEvents = [
        {
          roundNumber: 1,
          title: isFrench ? 'T1: Pression Concurrentielle & Choc de Vélocité' : 'Q1: Market Velocity Shock & Competitor Disruption',
          description: isFrench
            ? 'Un nouvel entrant sur le marché propose une expérience utilisateur instantanée et capte des parts de marché. Le comité exécutif exige une réponse.'
            : 'A venture-backed challenger has released a modern digital solution, pulling away market share. Executive committee demands response.',
          type: 'COMPETITIVE_SURGE',
          severity: 'MEDIUM',
          immediateImpact: { budgetFine: 50, tdiSurge: 5, velocityPenalty: 0 },
          choices: [
            {
              id: 'c1-patch',
              text: isFrench ? 'Empiler des wrappers rapides sur le monolithe (Livraison immédiate, forte dette)' : 'Deploy hasty API wrappers over legacy core (Immediate release, heavy debt surge)',
              capExImpact: 60,
              tdiImpact: 14,
              velocityImpact: 15,
              trustImpact: { 'sh-cpo': 12, 'sh-cto': -12 },
            },
            {
              id: 'c1-clean',
              text: isFrench ? 'Construire un microservice découplé via Strangler Fig (Fondation propre)' : 'Build decoupled microservice via strangler fig (Clean foundation)',
              capExImpact: 150,
              tdiImpact: -8,
              velocityImpact: -6,
              trustImpact: { 'sh-cto': 14, 'sh-cpo': -8, 'sh-cfo': -5 },
            },
            {
              id: 'c1-wait',
              text: isFrench ? 'Maintenir la feuille de route actuelle sans modification' : 'Absorb short-term loss while executing planned roadmap unchanged',
              capExImpact: 0,
              tdiImpact: 0,
              velocityImpact: 0,
              trustImpact: { 'sh-cpo': -15, 'sh-cfo': 5 },
            },
          ],
        },
        {
          roundNumber: 2,
          title: isFrench ? 'T2: Audit Réglementaire Imprévu & Conformité' : 'Q2: Surprise Regulatory Compliance & Security Audit',
          description: isFrench
            ? 'Les régulateurs déclenchent un contrôle surprise sur la traçabilité des données et les accès sensibles.'
            : 'Regulators have triggered an unannounced audit of data retention and access controls across legacy clusters.',
          type: 'AUDIT',
          severity: 'HIGH',
          immediateImpact: { budgetFine: 120, tdiSurge: 0, velocityPenalty: -12 },
          choices: [
            {
              id: 'c2-full-audit',
              text: isFrench ? 'Geler les chantiers 2 semaines pour mise en conformité exhaustive' : 'Freeze feature pipeline for 2 weeks to perform exhaustive architectural remediation',
              capExImpact: 180,
              tdiImpact: -12,
              velocityImpact: -18,
              trustImpact: { 'sh-cso': 22, 'sh-cpo': -18, 'sh-cto': 8 },
            },
            {
              id: 'c2-selective-patch',
              text: isFrench ? 'Patcher la passerelle API et demander une dérogation temporaire' : 'Apply perimeter patches to API gateway while submitting a temporary waiver',
              capExImpact: 75,
              tdiImpact: 4,
              velocityImpact: -5,
              trustImpact: { 'sh-cso': -5, 'sh-cfo': 8 },
            },
            {
              id: 'c2-external-counsel',
              text: isFrench ? 'Faire appel à un cabinet externe et payer une pénalité sans refonte' : 'Retain external crisis counsel and pay penalty without altering architecture',
              capExImpact: 220,
              tdiImpact: 0,
              velocityImpact: 0,
              trustImpact: { 'sh-cso': -18, 'sh-cfo': -12 },
            },
          ],
        },
        {
          roundNumber: 3,
          title: isFrench ? 'T3: Incident Black Swan & Saturation Monolithique' : 'Q3: Black Swan Deadlock & Peak Traffic Saturation',
          description: isFrench
            ? 'Un pic transactionnel sature les files d\'attente du monolithe, provoquant des pannes en cascade et l\'indisponibilité des services.'
            : 'Unprecedented volume triggers thread starvation in the monolithic core, freezing database write queues.',
          type: 'CRISIS',
          severity: 'BLACK_SWAN',
          immediateImpact: { budgetFine: 280, tdiSurge: 8, velocityPenalty: -20, downedNodeIds: ['node-app-2', 'node-data-1'] },
          choices: [
            {
              id: 'c3-circuit-breaker',
              text: isFrench ? 'Mise en place de disjoncteurs (Circuit Breakers) et réplicas asynchrones' : 'Emergency sharding: Spin up asynchronous read-replicas with circuit breakers',
              capExImpact: 190,
              tdiImpact: -15,
              velocityImpact: 5,
              trustImpact: { 'sh-cto': 16, 'sh-cfo': -10 },
            },
            {
              id: 'c3-hardware-overprovision',
              text: isFrench ? 'Surprovisionnement d\'urgence de serveurs cloud (Solution coûteuse)' : 'Emergency cloud compute scale-up (Throwing hardware at bad architecture)',
              capExImpact: 260,
              tdiImpact: 6,
              velocityImpact: -5,
              trustImpact: { 'sh-cfo': -16, 'sh-cpo': 8 },
            },
            {
              id: 'c3-rate-limit',
              text: isFrench ? 'Limiter drastiquement le trafic entrant pour éviter l\'effondrement total' : 'Aggressively throttle incoming customer traffic to prevent full system collapse',
              capExImpact: 40,
              tdiImpact: 0,
              velocityImpact: -15,
              trustImpact: { 'sh-cpo': -20, 'sh-cfo': -10, 'sh-cto': 6 },
            },
          ],
        },
        {
          roundNumber: 4,
          title: isFrench ? 'T4: Bilan du Conseil d\'Administration & Trajectoire Future' : 'Q4: Board Evaluation & Enterprise Modernization Verdict',
          description: isFrench
            ? 'Examen final par le Conseil d\'Administration. Analyse du TCO, de la dette résiduelle, de la vélocité et de la souveraineté acquise.'
            : 'Final fiscal review. The Board reviews TCO trajectory, technical debt index, delivery velocity, and operational uptime.',
          type: 'MARKET_SHIFT',
          severity: 'HIGH',
          immediateImpact: { budgetFine: 0, tdiSurge: 0, velocityPenalty: 0 },
          choices: [
            {
              id: 'c4-showcase',
              text: isFrench ? 'Présenter les acquis de modernisation et solliciter un budget d\'expansion' : 'Present comprehensive modernization achievements and request expansion capital',
              capExImpact: 100,
              tdiImpact: -5,
              velocityImpact: 10,
              trustImpact: { 'sh-cfo': 12, 'sh-cpo': 12, 'sh-cto': 12 },
            },
            {
              id: 'c4-cost-cut',
              text: isFrench ? 'Appliquer une politique d\'austérité pour maximiser la trésorerie à court terme' : 'Implement aggressive austerity measures to present inflated short-term cash reserves',
              capExImpact: -80,
              tdiImpact: 12,
              velocityImpact: -15,
              trustImpact: { 'sh-cfo': 18, 'sh-cto': -18, 'sh-cpo': -15 },
            },
            {
              id: 'c4-steady',
              text: isFrench ? 'Maintenir une gouvernance équilibrée sur le cycle suivant' : 'Maintain balanced operational pace into the subsequent fiscal cycle',
              capExImpact: 0,
              tdiImpact: 0,
              velocityImpact: 0,
              trustImpact: { 'sh-cfo': 5, 'sh-cto': 5 },
            },
          ],
        },
      ];

      initiativesCatalog = [
        {
          id: 'init-strangler-core',
          name: isFrench ? 'Découplage du Monolithe (Strangler Fig Pattern)' : 'Strangler Fig Migration: Core Monolith Decoupling',
          category: 'MODERNIZATION',
          description: isFrench
            ? 'Extraire progressivement les processus critiques du monolithe vers des services autonomes avec couche anti-corruption.'
            : 'Incrementally carve out high-risk workflows from the legacy monolith into domain microservices with an anti-corruption layer.',
          capExCost: 320,
          opExDelta: -35,
          tdiDelta: -22,
          velocityDelta: 16,
          resilienceDelta: 18,
          complianceDelta: 10,
          trustDelta: { 'sh-cto': 15, 'sh-cpo': 8, 'sh-cfo': -5 },
          affectedNodeIds: ['node-app-2', 'node-app-3'],
          durationRounds: 1,
          riskLevel: 'MEDIUM',
        },
        {
          id: 'init-event-driven-mesh',
          name: isFrench ? 'Backbone Événementiel & Découplage Kafka' : 'Event-Driven Backbone & Kafka Decoupling',
          category: 'MODERNIZATION',
          description: isFrench
            ? 'Remplacer les appels synchrones REST/JDBC par des flux asynchrones, éliminant les verrous de base de données.'
            : 'Transition synchronous point-to-point REST/JDBC dependencies to asynchronous event streams, eliminating database bottlenecks.',
          capExCost: 260,
          opExDelta: -20,
          tdiDelta: -16,
          velocityDelta: 12,
          resilienceDelta: 20,
          complianceDelta: 6,
          trustDelta: { 'sh-cto': 12, 'sh-cfo': -4 },
          affectedNodeIds: ['node-data-1', 'node-data-2', 'node-app-2'],
          durationRounds: 1,
          riskLevel: 'LOW',
        },
        {
          id: 'init-fast-track-features',
          name: isFrench ? 'Accélération Fonctionnelle (Contournement Architecture)' : 'Fast-Track Feature Surge (Architecture Bypass)',
          category: 'FEATURE_EXPEDITE',
          description: isFrench
            ? 'Coder en dur des accès directs à la base pour livrer immédiatement, en sacrifiant la gouvernance et la qualité.'
            : 'Hardcode direct database hooks and bypass architectural review to push high-visibility customer features ahead of schedule.',
          capExCost: 140,
          opExDelta: 45,
          tdiDelta: 18,
          velocityDelta: 24,
          resilienceDelta: -15,
          complianceDelta: -18,
          trustDelta: { 'sh-cpo': 22, 'sh-cto': -20, 'sh-cso': -16 },
          affectedNodeIds: ['node-biz-1', 'node-app-2'],
          durationRounds: 1,
          riskLevel: 'EXTREME',
        },
        {
          id: 'init-cloud-native-pivot',
          name: isFrench ? 'Migration Cloud Hybride & Conteneurisation Kubernetes' : 'Cloud Infrastructure & Kubernetes Mesh Lift',
          category: 'CLOUD_INFRA',
          description: isFrench
            ? 'Migrer les composants éligibles vers une infrastructure cloud élastique avec résilience multi-zone.'
            : 'Decommission legacy on-prem datacenter racks and migrate critical services to elastic multi-region cloud mesh.',
          capExCost: 380,
          opExDelta: -45,
          tdiDelta: -18,
          velocityDelta: 14,
          resilienceDelta: 24,
          complianceDelta: 12,
          trustDelta: { 'sh-cfo': 10, 'sh-cto': 14 },
          affectedNodeIds: ['node-infra-1', 'node-infra-2'],
          durationRounds: 1,
          riskLevel: 'HIGH',
        },
        {
          id: 'init-zero-trust-sec',
          name: isFrench ? 'Sécurité Zéro-Trust & Piste d\'Audit Automatisée' : 'Zero-Trust Security & Automated Audit Fabric',
          category: 'SECURITY_COMPLIANCE',
          description: isFrench
            ? 'Déployer mTLS sur le service mesh, rotation automatique des secrets et télémétrie d\'audit immuable.'
            : 'Deploy service-mesh mTLS, strict RBAC, automated secret rotation, and immutable compliance telemetry.',
          capExCost: 190,
          opExDelta: -10,
          tdiDelta: -10,
          velocityDelta: -4,
          resilienceDelta: 16,
          complianceDelta: 28,
          trustDelta: { 'sh-cso': 25, 'sh-cto': 10, 'sh-cpo': -6 },
          affectedNodeIds: ['node-app-1', 'node-data-1'],
          durationRounds: 1,
          riskLevel: 'LOW',
        },
        {
          id: 'init-ai-ops-copilot',
          name: isFrench ? 'AIOps Autonome & Détection Prédictive des Pannes' : 'Autonomous AI-Ops & Synthetic Traffic Sharding',
          category: 'AI_AUTOMATION',
          description: isFrench
            ? 'Sondes de télémétrie prédictive pour anticiper les congestions et déclencher l\'auto-remédiation.'
            : 'Deploy machine learning telemetry probes for predictive anomaly detection and automated self-healing.',
          capExCost: 220,
          opExDelta: -25,
          tdiDelta: -12,
          velocityDelta: 15,
          resilienceDelta: 18,
          complianceDelta: 5,
          trustDelta: { 'sh-cto': 10, 'sh-cfo': 8, 'sh-cpo': 8 },
          affectedNodeIds: ['node-app-1', 'node-app-3'],
          durationRounds: 1,
          riskLevel: 'MEDIUM',
        },
      ];
    }

    const scenario: Scenario = {
      id: `scen-${Date.now().toString(36)}`,
      title: scenarioTitle,
      industry: extractedIndustry,
      difficulty: extractedDifficulty,
      description: isFrench
        ? `Simulation de gouvernance technologique plaçant les équipes à la tête de l'architecture pour "${scenarioTitle}". Défi : ${rawChallenge.substring(0, 220)}... Concilier vélocité, réduction de la dette technique, conformité souveraine et rigueur budgétaire sur 4 trimestres.`
        : `Executive simulation placing teams at the helm of ${scenarioTitle} in ${extractedIndustry}. Core Mission: ${rawChallenge.substring(0, 220)}... Balance rapid delivery with architectural technical debt reduction, regulatory compliance, and fiscal discipline across 4 quarters.`,
      businessContext: rawChallenge,
      baselineMetrics: {
        tco: 1850,
        budgetRemaining: 1200,
        opEx: 480,
        capExSpent: 300,
        technicalDebtIndex: tdi,
        deliveryVelocity: velocity,
        stakeholderTrust: stakeholderTrust,
        resilienceIndex: 52,
        complianceScore: compliance,
        modernizedNodesCount: 2,
      },
      winLossConditions: {
        maxTechnicalDebtIndex: 45,
        minStakeholderTrustAvg: 60,
        minDeliveryVelocity: 65,
        minResilienceIndex: 70,
        maxTCOBudget: 3600,
        targetCapabilitiesModernized: 5,
      },
      totalRounds: 4,
      topology: { nodes, edges },
      stakeholders,
      roundEvents,
      initiativesCatalog,
      tags: [extractedIndustry, isOffshore ? 'Offshore Governance' : 'Architecture Strategy', isOffshore ? 'Sovereignty' : 'Monolith Decoupling', 'OpEx Optimization'],
      author: 'GemSim AI Studio Heuristic Engine',
      isDefault: false,
      createdAt: new Date().toISOString(),
    };

    return scenario;
  }
}
