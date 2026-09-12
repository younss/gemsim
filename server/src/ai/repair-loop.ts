// ============================================================================
// GEMSIM: SELF-HEALING JSON REPAIR LOOP
// Replaces silent defaulting with an active iterative repair feedback loop.
// When an LLM outputs malformed JSON or schema deviations, this loop prompts
// the model with the exact syntax/schema error to repair the object.
// ============================================================================

import { AIMessage } from './types.js';

export interface RepairOptions<T> {
  maxRepairs?: number;
  schemaDescription?: string;
  validator?: (parsed: any) => { valid: boolean; error?: string };
}

export class JSONRepairError extends Error {
  public readonly rawOutputs: string[];
  public readonly attempts: number;

  constructor(message: string, rawOutputs: string[], attempts: number) {
    super(message);
    this.name = 'JSONRepairError';
    this.rawOutputs = rawOutputs;
    this.attempts = attempts;
  }
}

/**
 * Robust JSON extraction and sanitizer
 */
export function sanitizeAndParseJSON<T>(rawText: string): T {
  try {
    return JSON.parse(rawText) as T;
  } catch {
    const cleaned = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*$/gi, '')
      .trim();

    try {
      return JSON.parse(cleaned) as T;
    } catch {
      // Find outermost brackets
      const firstBrace = cleaned.indexOf('{');
      const firstBracket = cleaned.indexOf('[');
      let startIdx = -1;

      if (firstBrace !== -1 && firstBracket !== -1) {
        startIdx = Math.min(firstBrace, firstBracket);
      } else if (firstBrace !== -1) {
        startIdx = firstBrace;
      } else {
        startIdx = firstBracket;
      }

      const lastBrace = cleaned.lastIndexOf('}');
      const lastBracket = cleaned.lastIndexOf(']');
      const endIdx = Math.max(lastBrace, lastBracket);

      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        let substring = cleaned.substring(startIdx, endIdx + 1);

        // Remove trailing commas before closing braces/brackets
        substring = substring.replace(/,\s*([\}\]])/g, '$1');

        try {
          return JSON.parse(substring) as T;
        } catch (subErr: any) {
          throw new Error(`JSON Syntax Error: ${subErr.message} in snippet: ${substring.substring(0, 150)}...`);
        }
      }

      throw new Error(`No valid JSON structure found in raw output (${rawText.substring(0, 100)}...)`);
    }
  }
}

/**
 * Executes an LLM generation with an active repair loop if JSON parsing or validation fails
 */
export async function executeWithRepairLoop<T>(
  generateTextFn: (messages: AIMessage[], systemPrompt?: string) => Promise<string>,
  initialMessages: AIMessage[],
  systemPrompt: string,
  options: RepairOptions<T> = {}
): Promise<T> {
  const maxRepairs = options.maxRepairs ?? 2;
  const history: string[] = [];

  let currentMessages = [...initialMessages];
  let currentSystemPrompt = systemPrompt;

  for (let attempt = 0; attempt <= maxRepairs; attempt++) {
    const rawOutput = await generateTextFn(currentMessages, currentSystemPrompt);
    history.push(rawOutput);

    try {
      const parsed = sanitizeAndParseJSON<T>(rawOutput);

      // If a schema validator is provided, check business constraints
      if (options.validator) {
        const validation = options.validator(parsed);
        if (!validation.valid) {
          throw new Error(`Schema Validation Error: ${validation.error || 'Object violates required schema'}`);
        }
      }

      if (attempt > 0) {
        console.log(`[JSONRepairLoop] Successfully repaired JSON on attempt ${attempt + 1}/${maxRepairs + 1}`);
      }

      return parsed;
    } catch (parseOrValidationError: any) {
      console.warn(
        `[JSONRepairLoop] Attempt ${attempt + 1}/${maxRepairs + 1} failed: ${parseOrValidationError.message}`
      );

      if (attempt >= maxRepairs) {
        throw new JSONRepairError(
          `Échec de la boucle de réparation JSON après ${maxRepairs + 1} tentatives: ${parseOrValidationError.message}`,
          history,
          attempt + 1
        );
      }

      // Build active repair prompt
      const repairPrompt = `The previous JSON response you generated was INVALID and failed to parse or validate:
ERROR: ${parseOrValidationError.message}

ORIGINAL BROKEN OUTPUT (extract):
${rawOutput.substring(0, 600)}

${options.schemaDescription ? `REQUIRED SCHEMA SPECIFICATION:\n${options.schemaDescription}\n` : ''}
DIRECTIVE: Fix the syntax or schema error. Return ONLY the fully corrected, strictly valid JSON object. No commentary, no explanations, no markdown formatting.`;

      currentMessages = [
        ...initialMessages,
        { role: 'assistant', content: rawOutput },
        { role: 'user', content: repairPrompt },
      ];
      currentSystemPrompt = `You are an elite JSON repair compiler. Your sole purpose is to output syntactically flawless, strictly valid JSON without any markdown formatting.`;
    }
  }

  throw new JSONRepairError('Unexpected repair loop exit', history, maxRepairs);
}
