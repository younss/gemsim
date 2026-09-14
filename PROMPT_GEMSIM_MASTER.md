# MASTER PROMPT : GÉNÉRATEUR COMPLET DE LA PLATEFORME "GEMSIM" (SIMULATEUR STRATÉGIQUE D'ARCHITECTURE D'ENTREPRISE & CRISE DE GOUVERNANCE IT)

Tu es un Principal Full-Stack Software Engineer, un expert Three.js / WebGL et un Architecte Logiciel d'Entreprise chevronné.
Ta mission est de concevoir, implémenter et déployer de zéro l'application complète **GemSim** : une plateforme web interactive et immersive de simulation de gouvernance technologique, d'arbitrage budgétaire et de gestion de crise d'architecture d'entreprise.

---

## 1. VISION DU PRODUIT & GAMEPLAY LOOP

GemSim est un simulateur de vol stratégique (Serious Game) destiné aux DSI, CTO, Lead Enterprise Architects et CFO.
- **Cycle de jeu** : Simulation séquentielle sur 4 trimestres (Q1 à Q4).
- **Objectif du joueur** : Naviguer entre arbitrages budgétaires (CAPEX/OPEX), conformité réglementaire (DORA, RGPD, NIS2), souveraineté technologique, vélocité de livraison et dette technique, tout en conservant la confiance du comité de direction (Stakeholders C-Suite).
- **Dynamique de décision** : À chaque trimestre, le joueur sélectionne des initiatives architecturales, subit des crises de gouvernance imprévues, négocie en tête-à-tête avec des stakeholders autonomes pilotés par LLM, et participe à un grand comité exécutif interactif ("Executive Boardroom Meeting").

---

## 2. STACK TECHNIQUE & ARCHITECTURE SYSTÈME

### Frontend
- **Framework** : React 18+ / Vite / TypeScript en mode strict.
- **Styling** : Tailwind CSS, Lucide Icons, composants Glassmorphism sombres (thème cyber-corporate cyberpunk/slate foncé).
- **Moteur 3D** : Three.js (r160+ ou r186) avec `@types/three` sans dépendance externe lourde (Canvas natif managé dans un composant React avec `OrbitControls`).
- **State Management** : Zustand ou React Context pour l'état de session réactif.

### Backend & Données
- **Runtime** : Node.js (Express ou Fastify) en TypeScript avec validation de schémas (Zod).
- **Base de données & ORM** : Prisma ORM avec schéma PostgreSQL (support d'un driver SQLite / `better-sqlite3` pour l'embarqué local sans configuration).
- **Gestion des Tâches Asynchrones** : BullMQ + Redis pour les calculs de simulation asynchrones et l'orchestration des événements.
- **Temps Réel & Streaming** : Server-Sent Events (SSE) ou WebSockets pour le streaming de dialogues LLM et la télémétrie de simulation.

---

## 3. MOTEUR DE SIMULATION & MODÈLE MATHÉMATIQUE

Le moteur doit calculer l'état de l'entreprise via une matrice d'impact déterministe et prédictive :

```typescript
export interface EnterpriseState {
  quarter: number; // 1 à 4
  metrics: {
    budgetRemaining: number;       // Budget disponible en k€
    runOpexMonthly: number;        // Coût récurrent d'exploitation
    capexAllocated: number;        // Investissements de transformation
    technicalDebtIndex: number;    // 0 à 100 (au-delà de 70 = instabilité critique)
    architectureCompliance: number;// 0 à 100%
    sovereignControlScore: number; // 0 à 100% (souveraineté données & code)
    incidentMTTRMinutes: number;   // Temps moyen de réparation en production
    teamAttritionRisk: number;     // 0 à 100% (risque de démission des seniors)
  };
  topologyNodes: TopologyNode[];   // État de santé des 8 à 12 composants du SI
  stakeholderTrust: Record<string, number>; // Score de confiance 0-100 par NPC
}
```

- **Propagation des impacts** : Chaque initiative choisie modifie le vecteur de métriques. Les crises non traitées entraînent des pénalités cumulatives (cascade failures) aux tours suivants.
- **Calcul de fin de partie (Post-Mortem)** : Calcul d'un score de maturité finale (A+ à F) basé sur la résilience globale, la solvabilité et le score de dette technique.

---

## 4. TOPOLOGIE SPATIALE 3D ("TOPOLOGY STAGE" THREE.JS HAUTE FIDÉLITÉ)

Implémente un composant `EnterpriseCanvas.tsx` reproduisant l'élégance architecturale des digital twins d'entreprise (façon OpenAI Codex Topology) :

1. **Structure HTML & Ergonomie** :
   ```html
   <div class="topology-stage">
     <canvas data-engine="three.js r186" aria-label="Interactive 3D enterprise topology. Use node buttons for keyboard access."></canvas>
   </div>
   ```
2. **Archétypes Visuels 3D des Bâtiments** :
   - **TOWERS (Piles d'étages en verre)** : Pour les pipelines CI/CD, usines offshore et passerelles d'architecture (`MeshPhysicalMaterial`, transmission 0.65, roughness 0.15, avec arêtes néon biseautées via `LineSegments(EdgesGeometry)`).
   - **FLUTED CYLINDERS (Cylindres cannelés)** : Pour les bases de données, coffres-forts de données et reporting réglementaire (fûts verticaux avec nervures de wireframe et anneau lumineux pulsant au sol "halo ring").
   - **SOLID SLABS (Blocs de verre monolithiques)** : Pour les microservices métier et modules onshore.
   - **GROUND PEDESTALS (Socles d'ancrage)** : Chaque structure repose sur une plinthe sombre en verre fumé ancrée dans la grille isométrique du sol.
3. **Floating 3D Text Billboards** :
   - Badges de texte générés via Canvas 2D haute résolution (1024x256), convertis en `CanvasTexture` sur un `Sprite`.
   - Propriétés : `depthTest: false`, `depthWrite: false` pour garantir une netteté totale et zéro occlusion par la géométrie en verre.
   - Toujours orientés face à la caméra (`sprite.quaternion.copy(camera.quaternion)`).
4. **Télémétrie Lumineuse (Data Conduits)** :
   - Flux de dépendances Onshore <-> Offshore modélisés par des courbes de Bézier quadratiques (`QuadraticBezierCurve3`).
   - Particules luminescentes (photons de données) se déplaçant le long des courbes en continu.
5. **Contrôles Cockpit** :
   - Badge `LIVE ENTERPRISE MODEL`, bouton Reset Caméra avec animation fluide (Slerp / Tween), mode Plein Écran, bouton Auto-Orbit, et sélection/focus de nœud au clic.

---

## 5. AGENTS AUTONOMES C-SUITE & SYSTÈME ANTI-TRICHE PSYCHOLOGIQUE

### Profils Psychologiques des Parties Prenantes
- **Julien Marchand (CFO)** : Obsédé par le ROI court terme, la réduction des coûts OPEX et la maîtrise du budget. Méfiant envers les refactorings "invisibles".
- **Claire Vasseur (Directrice de l'Architecture & CISO)** : Protectrice de la souveraineté technologique, rigide sur la dette technique, conformité DORA et isolation des données sensibles.
- **Rajesh Sharma (Directeur Delivery ESN Offshore)** : Focalisé sur le débit de livraison, les marges contractuelles et le respect des engagements de vélocité.

### Dialogue LLM Intelligent & Mécanique Anti-Triche
- **Anti-Cheat / Sémantique Critique** : L'agent LLM ne doit **JAMAIS** augmenter arbitrairement sa jauge de confiance si le joueur répète les mêmes arguments ou flatte l'interlocuteur. L'agent évalue la cohérence de l'argument par rapport à ses propres objectifs d'affaires et détecte les contradictions.
- **Jauges de Patience & Scepticisme** : Chaque partie prenante a un niveau de patience qui diminue si le joueur formule des promesses vagues sans allocation budgétaire claire.

---

## 6. COMITÉ EXÉCUTIF COLLECTIF ("EXECUTIVE BOARDROOM MEETING")

En plus des négociations 1-to-1, implémente une salle de réunion plénière :
- Le joueur convoque l'ensemble des Stakeholders autour d'une table ronde virtuelle.
- Le joueur soumet sa stratégie globale pour le trimestre.
- **Débat croisé entre PNJ** : Les agents PNJ se répondent entre eux (ex: la Directrice de l'Architecture interpelle directement le CFO lorsque celui-ci demande une coupe budgétaire sur les tests automatisés).
- Vote de gouvernance avec jauge d'alignement collectif en temps réel avant validation finale du tour.

---

## 7. GESTION PROGRESSIVE DES CRISES & BLACK SWANS

- **Pas d'exposition prématurée** : Les crises ne doivent pas toutes être affichées au Round 1.
- **Émergence conditionnelle** :
  - **Q1** : Tension budgétaire initiale et friction de gouvernance.
  - **Q2** : Crise de vélocité / turnover de l'équipe offshore.
  - **Q3 (Black Swan)** : Audit inopiné de conformité DORA/RGPD ou faille zero-day dans le pipeline de déploiement.
  - **Q4** : Crise systémique de résilience opérationnelle ou succès de la bascule architecturale.
- Les Black Swans peuvent être injectés dynamiquement selon l'indice de dette technique ou déclenchés manuellement par un Facilitateur.

---

## 8. RÉSILIENCE IA DE PRODUCTION & QUALITÉ SYSTÈME

1. **Streaming LLM (`stream: true`)** : Tous les dialogues avec les stakeholders et le studio doivent streamer leur réponse token par token vers l'UI avec gestion fluide de l'autoscroll.
2. **Timeouts Explicites Configurables** : Chaque appel IA doit disposer d'un `AbortController` avec timeout configurable (ex: 20s en dialogue, 45s en génération de scénario complexe) plutôt qu'un blocage silencieux de 300s.
3. **Circuit Breaker Pattern** :
   - 3 échecs consécutifs d'API LLM -> Passage de l'état en `OPEN` pendant 60 secondes.
   - Message explicite à l'utilisateur : *"Fournisseur IA momentanément indisponible. Réessai automatique dans 60s."*
4. **Self-Healing JSON Repair Loop** :
   - En cas de sortie JSON invalide émise par un modèle, ne pas faire de fallback silencieux trompeur.
   - Exécuter une boucle de correction automatique (jusqu'à 3 itérations) renvoyant l'erreur de parsing exacte au modèle pour qu'il répare sa syntaxe.

---

## 9. AI SCENARIO STUDIO & SCÉNARIO PRÉ-CONFIGURÉ

### Module Studio
Un éditeur permettant à un administrateur ou formateur de taper un prompt en langage naturel (ex: *"Crée une crise de migration Cloud dans le secteur bancaire"*). L'IA génère le JSON complet validé par Zod :
- Métadonnées et contexte narratif.
- Coordonnées 3D spatiales (X, Y, Z, layer, type).
- Personas psychologiques des Stakeholders.
- Arbre de décisions et crises sur 4 trimestres.

### Scénario Référence Inclus : "Mirage Offshore : Arbitrage Coûts, Souveraineté et Dette Technique"
- **Topologie 8 nœuds** : `Offshore Delivery Center`, `Regulatory Reporting`, `Dev Pipeline`, `Architecture Guardrail`, `Knowledge Base`, `Onshore Engineering`, `Core Business Logic`, `Sensitive Data Vault`.
- **Enjeux** : Arbitrage entre coûts de développement délocalisés et souveraineté / fuite de données critiques sous réglementation européenne.

---

## 10. FACILITATOR ROOM (MODE WORKSHOP MULTI-JOUEURS)

- Espace animateur permettant de visualiser plusieurs équipes ou joueurs en parallèle.
- Tableau de bord en temps réel des métriques de chaque équipe.
- Bouton "Injecter un Black Swan instantané" pour tester la réactivité des participants en cours d'atelier.
- Rapport comparatif et debriefing automatisé en fin de session.

---

## ATTENTES D'EXÉCUTION
Génère le code source de manière modulaire, propre et directement exécutable avec :
1. Les schémas Zod et types TypeScript (`shared/types.ts`).
2. Le moteur mathématique et de simulation (`server/src/simulation/`).
3. Le composant 3D Three.js complet avec shaders, biseaux et billboards (`client/src/components/3d/EnterpriseCanvas.tsx`).
4. Les modules de résilience IA (Streaming, Circuit Breaker, JSON Repair Loop).
5. L'interface de dialogue stakeholder et le boardroom meeting.
