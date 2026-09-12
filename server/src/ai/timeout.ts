// ============================================================================
// GEMSIM: EXPLICIT AI TIMEOUT & CANCELLATION MANAGER
// Replaces hidden 300s timeouts with explicit, configurable deadlines.
// ============================================================================

export class AITimeoutError extends Error {
  public readonly timeoutMs: number;
  public readonly operationName: string;

  constructor(operationName: string, timeoutMs: number) {
    super(
      `L'appel IA pour '${operationName}' a expiré après ${timeoutMs / 1000}s (délai configurable dépassé). Le modèle local ou distant ne répond pas dans le temps alloué.`
    );
    this.name = 'AITimeoutError';
    this.timeoutMs = timeoutMs;
    this.operationName = operationName;
  }
}

export function getAITimeout(purpose: 'CHAT' | 'STUDIO' | 'DEFAULT' = 'DEFAULT', overrideMs?: number): number {
  if (overrideMs && overrideMs > 0) return overrideMs;

  const envChat = parseInt(process.env.AI_CHAT_TIMEOUT_MS || '', 10);
  const envStudio = parseInt(process.env.AI_STUDIO_TIMEOUT_MS || '', 10);
  const envDefault = parseInt(process.env.AI_DEFAULT_TIMEOUT_MS || '', 10);

  if (purpose === 'CHAT') {
    return !isNaN(envChat) && envChat > 0 ? envChat : 45000; // 45 seconds default for negotiation chat
  }

  if (purpose === 'STUDIO') {
    return !isNaN(envStudio) && envStudio > 0 ? envStudio : 120000; // 120 seconds default for studio synthesis
  }

  return !isNaN(envDefault) && envDefault > 0 ? envDefault : 45000;
}

export async function withTimeout<T>(
  promiseFactory: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  operationName: string = 'Opération IA'
): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AITimeoutError(operationName, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promiseFactory(controller.signal), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
