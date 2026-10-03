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

export const submitDecisionsSchema = z.object({
  teamId: id,
  decisions: z.object({
    selectedInitiativeIds: z.array(id).max(20),
    eventChoiceId: id.optional(),
    governancePosture: governancePostureSchema,
    customPacts: z.array(z.unknown()).optional().default([]), // ignored: pacts are server-held
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
});

export const boardroomSchema = z.object({
  sessionId: id,
  teamId: id,
  playerMessage: z.string().trim().min(1).max(4000),
});

export const studioGenerateSchema = z.object({
  industry: z.string().trim().min(1).max(200),
  businessChallenge: z.string().trim().min(1).max(20000),
  targetScale: z.string().max(200).optional(),
  difficulty: z.enum(['ENTRY', 'INTERMEDIATE', 'EXECUTIVE', 'CRISIS_CHIEF']).optional(),
  customDirectives: z.string().max(5000).optional(),
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
