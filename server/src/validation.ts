// ============================================================================
// GEMSIM: REQUEST VALIDATION (ZOD)
// Schemas for every mutating endpoint; invalid payloads get a 400 with details.
// ============================================================================

import { RequestHandler } from 'express';
import { z, ZodTypeAny } from 'zod';

const id = z.string().trim().min(1).max(200);

export const governancePostureSchema = z.enum(['BYPASS_ARCH', 'BALANCED_AGILE', 'STRICT_GOVERNANCE', 'ACCELERATED_MODERN']);

export const createSessionSchema = z.object({
  name: z.string().trim().max(200).optional(),
  scenarioId: id,
  teamNames: z.array(z.string().trim().min(1).max(80)).min(1).max(5).optional(),
  roundDurationSeconds: z.number().int().min(30).max(7200).optional(),
});

const decisionSchema = z.object({
  selectedInitiativeIds: z.array(id).max(20),
  eventChoiceId: id.optional(),
  governancePosture: governancePostureSchema,
  customPacts: z.array(z.unknown()).optional().default([]),
  market: z
    .object({
      prices: z.record(id, z.number().finite().positive()).default({}),
      marketing: z.record(id, z.number().finite().min(0).max(1_000_000)).default({}),
      enter: z.array(id).max(20).optional(),
    })
    .optional(),
});

/** "What if" replay: one past quarter with another decision (pacts keep what was signed). */
export const whatIfSchema = z.object({
  teamId: id,
  round: z.number().int().min(1).max(12).optional(),
  decision: decisionSchema.omit({ customPacts: true }).optional(),
});

/** The coach's facts, already in the player's language, for the LLM to rephrase. */
export const coachSchema = z.object({
  lang: z.enum(['fr', 'en']),
  teamName: z.string().trim().min(1).max(120),
  round: z.number().int().min(1).max(12),
  insights: z.array(z.string().max(400)).max(10),
  advice: z.array(z.string().max(400)).max(5),
});

export const pilotPhaseSchema = z.object({
  phase: z.enum(['PRE', 'POST']),
  open: z.boolean(),
});

export const pilotResponseSchema = z.object({
  teamId: id,
  phase: z.enum(['PRE', 'POST']),
  respondentId: z.string().trim().min(8).max(64),
  answers: z.array(z.number().int().min(-1).max(5)).max(20),
  satisfaction: z.array(z.number().int().min(1).max(5)).max(10).optional(),
  hindrance: z.string().max(1000).optional(),
  lesson: z.string().max(1000).optional(),
});

export const submitDecisionsSchema = z.object({
  teamId: id,
  decisions: z.object({
    selectedInitiativeIds: z.array(id).max(20),
    eventChoiceId: id.optional(),
    governancePosture: governancePostureSchema,
    customPacts: z.array(z.unknown()).optional().default([]), // ignored: pacts are server-held
    market: z
      .object({
        prices: z.record(id, z.number().finite().positive()).default({}),
        marketing: z.record(id, z.number().finite().min(0).max(1_000_000)).default({}),
        enter: z.array(id).max(20).optional(),
      })
      .optional(),
  }),
});

export const pactSchema = z.object({
  teamId: id,
  stakeholderId: id,
  concession: z.string().trim().min(3).max(500),
  committedBudget: z.number().min(0).max(100000),
});

export const injectEventSchema = z.object({
  event: z.object({
    title: z.string().trim().min(1).max(300),
    description: z.string().max(4000).default(''),
    type: z.enum(['DISRUPTION', 'CRISIS', 'AUDIT', 'MARKET_SHIFT', 'VENDOR_EOL', 'COMPETITIVE_SURGE']).default('CRISIS'),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'BLACK_SWAN']).default('HIGH'),
    immediateImpact: z
      .object({
        budgetFine: z.number().min(0).max(100000).default(0),
        tdiSurge: z.number().min(-100).max(100).default(0),
        velocityPenalty: z.number().min(-100).max(100).default(0),
        downedNodeIds: z.array(id).optional(),
      })
      .optional(),
    choices: z
      .array(
        z.object({
          id,
          text: z.string().min(1).max(1000),
          capExImpact: z.number(),
          tdiImpact: z.number(),
          velocityImpact: z.number(),
          trustImpact: z.record(z.number()).default({}),
          nodeHealthImpacts: z.record(z.number()).optional(),
        })
      )
      .optional(),
  }).passthrough(),
});

export const broadcastSchema = z.object({ message: z.string().trim().min(1).max(1000) });

export const negotiateSchema = z.object({
  sessionId: id,
  teamId: id,
  stakeholderId: id,
  playerMessage: z.string().trim().min(1).max(4000),
  lang: z.enum(['fr', 'en']).optional(), // the player's interface language: executives answer in it
});

export const boardroomSchema = z.object({
  sessionId: id,
  teamId: id,
  playerMessage: z.string().trim().min(1).max(4000),
  lang: z.enum(['fr', 'en']).optional(),
});

export const systemOneSettingsSchema = z.object({
  provider: z.enum(['ollama', 'gemini', 'claude', 'openai', 'custom']).optional(),
  baseUrl: z.union([z.literal(''), z.string().trim().url().max(300)]).optional(),
  model: z.string().trim().min(1).max(200).optional(),
  apiKey: z.string().trim().max(500).optional(),
  timeoutMs: z.number().int().min(1000).max(120000).optional(),
  enabled: z.boolean().optional(),
});

// The test runs a candidate configuration without applying it
export const systemOneSampleSchema = systemOneSettingsSchema;

// System 2: the same sample reply with a candidate provider configuration, without applying it
export const aiSampleSchema = z.object({
  provider: z.enum(['ollama', 'gemini', 'claude', 'openai', 'custom', 'fallback']),
  model: z.string().trim().max(200).optional(),
  baseUrl: z.union([z.literal(''), z.string().trim().url().max(300)]).optional(),
  apiKey: z.string().trim().max(500).optional(),
  lang: z.enum(['fr', 'en']).optional(),
});

export const studioGenerateSchema = z.object({
  industry: z.string().trim().min(1).max(200),
  businessChallenge: z.string().trim().min(1).max(20000),
  targetScale: z.string().max(200).optional(),
  difficulty: z.enum(['ENTRY', 'INTERMEDIATE', 'EXECUTIVE', 'CRISIS_CHIEF']).optional(),
  customDirectives: z.string().max(5000).optional(),
  domain: z.enum(['IT', 'INDUSTRIAL', 'MARKET_EXPANSION', 'SOURCING', 'GENERIC']).optional(),
  withMarket: z.boolean().optional(),
  rounds: z.number().int().min(1).max(4).optional(),
}).passthrough();

/** Express middleware: replaces req.body with the parsed value or answers 400. */
export function validateBody(schema: ZodTypeAny): RequestHandler<any, any, any, any> {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    req.body = parsed.data;
    next();
  };
}

export const timerSchema = z.object({
  isRunning: z.boolean().optional(),
  secondsRemaining: z.number().int().min(0).max(7200).optional(),
});
