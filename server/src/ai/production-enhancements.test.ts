import assert from 'node:assert';
import test from 'node:test';
import { CircuitBreaker, CircuitBreakerOpenError } from './circuit-breaker.js';
import { getAITimeout, withTimeout, AITimeoutError } from './timeout.js';
import { sanitizeAndParseJSON, executeWithRepairLoop, JSONRepairError } from './repair-loop.js';
import { QueueManager } from '../queue/index.js';
import { PrismaRepository } from '../db/prisma.js';

test('CircuitBreaker trips to OPEN after 3 consecutive failures with 60s cooldown', async () => {
  const breaker = new CircuitBreaker({
    name: 'Test-LLM',
    failureThreshold: 3,
    cooldownMs: 60000,
  });

  assert.strictEqual(breaker.getState(), 'CLOSED');

  // Failure 1
  await assert.rejects(
    () => breaker.execute(async () => { throw new Error('API down 1'); }),
    /API down 1/
  );
  assert.strictEqual(breaker.getState(), 'CLOSED');

  // Failure 2
  await assert.rejects(
    () => breaker.execute(async () => { throw new Error('API down 2'); }),
    /API down 2/
  );
  assert.strictEqual(breaker.getState(), 'CLOSED');

  // Failure 3 -> Trips to OPEN
  await assert.rejects(
    () => breaker.execute(async () => { throw new Error('API down 3'); }),
    /API down 3/
  );
  assert.strictEqual(breaker.getState(), 'OPEN');
  assert.strictEqual(breaker.getRemainingCooldownSeconds() > 0, true);

  // 4th call immediately blocked by CircuitBreakerOpenError
  await assert.rejects(
    () => breaker.execute(async () => 'should not run'),
    (err: any) => {
      assert(err instanceof CircuitBreakerOpenError);
      assert(err.message.includes('Circuit breaker actif pour \'Test-LLM\' (3 échecs consécutifs)'));
      assert(err.message.includes('réessayez dans 1 min') || err.message.includes('réessayez dans'));
      return true;
    }
  );

  // Reset restores CLOSED
  breaker.reset();
  assert.strictEqual(breaker.getState(), 'CLOSED');
  const result = await breaker.execute(async () => 'recovered');
  assert.strictEqual(result, 'recovered');
});

test('Timeout Manager enforces configurable deadlines and throws explicit AITimeoutError', async () => {
  // Test default deadlines
  const chatTimeout = getAITimeout('CHAT');
  const studioTimeout = getAITimeout('STUDIO');
  assert.strictEqual(chatTimeout, 45000);
  assert.strictEqual(studioTimeout, 120000);

  // Test override
  const custom = getAITimeout('CHAT', 15000);
  assert.strictEqual(custom, 15000);

  // Test withTimeout abort and explicit error
  await assert.rejects(
    () => withTimeout(
      async (signal) => {
        await new Promise((resolve, reject) => {
          const t = setTimeout(resolve, 500);
          signal.addEventListener('abort', () => {
            clearTimeout(t);
            reject(new Error('Aborted'));
          });
        });
      },
      50, // 50ms timeout
      'Ollama-Chat'
    ),
    (err: any) => {
      assert(err instanceof AITimeoutError);
      assert(err.message.includes("L'appel IA pour 'Ollama-Chat' a expiré après 0.05s"));
      assert.strictEqual(err.timeoutMs, 50);
      return true;
    }
  );
});

test('Self-Healing JSON Repair Loop heals malformed outputs without silent defaulting', async () => {
  // Test 1: Sanitize markdown and trailing commas
  const dirtyMarkdown = '```json\n{\n  "status": "ok",\n  "count": 42,\n}\n```';
  const parsed = sanitizeAndParseJSON<{ status: string; count: number }>(dirtyMarkdown);
  assert.strictEqual(parsed.status, 'ok');
  assert.strictEqual(parsed.count, 42);

  // Test 2: Multi-step repair loop
  let attemptCounter = 0;
  const simulatedLLM = async (messages: any[], systemPrompt?: string) => {
    attemptCounter++;
    if (attemptCounter === 1) {
      // Return broken JSON on attempt 1
      return '{"responseDialogue": "Bonjour", "evaluation": { unquoted_key: 123 }';
    }
    // Repaired JSON on attempt 2
    return '{"responseDialogue": "Bonjour corrigé", "evaluation": {"trustDelta": 5}}';
  };

  const repaired = await executeWithRepairLoop<{ responseDialogue: string; evaluation: { trustDelta: number } }>(
    simulatedLLM,
    [{ role: 'user', content: 'test' }],
    'System prompt',
    { maxRepairs: 2 }
  );

  assert.strictEqual(repaired.responseDialogue, 'Bonjour corrigé');
  assert.strictEqual(repaired.evaluation.trustDelta, 5);
  assert.strictEqual(attemptCounter, 2);

  // Test 3: Exhaustion throws JSONRepairError instead of silent defaulting
  const alwaysBrokenLLM = async () => 'broken {}{}{';
  await assert.rejects(
    () => executeWithRepairLoop(alwaysBrokenLLM, [{ role: 'user', content: 'fail' }], 'System', { maxRepairs: 1 }),
    (err: any) => {
      assert(err instanceof JSONRepairError);
      assert(err.message.includes('Échec de la boucle de réparation JSON'));
      return true;
    }
  );
});

test('BullMQ and Prisma Subsystems initialize with graceful fallback', () => {
  const queueManager = QueueManager.getInstance();
  assert(queueManager);
  const health = queueManager.getHealth();
  assert.strictEqual(typeof health.isRedisConnected, 'boolean');

  const prismaRepo = PrismaRepository.getInstance();
  assert(prismaRepo);
  assert.strictEqual(typeof prismaRepo.isAvailable(), 'boolean');
});
