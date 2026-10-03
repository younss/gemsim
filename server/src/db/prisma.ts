import { PrismaClient } from '@prisma/client';
import { Scenario, SimulationSession, ChatMessage, ArchivedSimulationRun } from '../types/index.js';

let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return prismaInstance;
}

export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}

export class PrismaRepository {
  private static instance: PrismaRepository;
  private prisma: PrismaClient | null = null;
  private isConnected = false;
  private ready: Promise<boolean>;
  private writeChains = new Map<string, Promise<void>>();

  /** Runs writes for the same record in call order, so a stale upsert never lands last. */
  private serialize(key: string, write: () => Promise<void>): Promise<void> {
    const next = (this.writeChains.get(key) ?? Promise.resolve()).then(write, write);
    this.writeChains.set(key, next);
    void next.finally(() => {
      if (this.writeChains.get(key) === next) this.writeChains.delete(key);
    });
    return next;
  }

  private constructor() {
    this.ready = this.connect();
  }

  private async connect(): Promise<boolean> {
    if (!process.env.DATABASE_URL) return false;
    try {
      this.prisma = getPrismaClient();
      await this.prisma.$connect();
      this.isConnected = true;
      console.log('[PrismaRepository] Connected to PostgreSQL via Prisma ORM.');
      return true;
    } catch (err: any) {
      console.warn(`[PrismaRepository] PostgreSQL unavailable, running on SQLite only: ${err.message}`);
      this.isConnected = false;
      return false;
    }
  }

  /** Resolves once the initial PostgreSQL connection attempt has finished. */
  public whenReady(): Promise<boolean> {
    return this.ready;
  }

  public static getInstance(): PrismaRepository {
    if (!PrismaRepository.instance) {
      PrismaRepository.instance = new PrismaRepository();
    }
    return PrismaRepository.instance;
  }

  public isAvailable(): boolean {
    return Boolean(this.prisma && this.isConnected);
  }

  // --- Scenarios ---
  public async saveScenario(scenario: Scenario): Promise<void> {
    if (!this.prisma || !this.isConnected) return;
    try {
      await this.prisma.scenario.upsert({
        where: { id: scenario.id },
        create: {
          id: scenario.id,
          title: scenario.title,
          industry: scenario.industry,
          isDefault: scenario.isDefault || false,
          data: scenario as any,
        },
        update: {
          title: scenario.title,
          industry: scenario.industry,
          data: scenario as any,
        },
      });
    } catch (err: any) {
      console.warn(`[PrismaRepository] saveScenario failed: ${err.message}`);
    }
  }

  public async getScenarios(): Promise<Scenario[]> {
    if (!this.prisma || !this.isConnected) return [];
    try {
      const records = await this.prisma.scenario.findMany({
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
      return records.map((r: any) => r.data as Scenario);
    } catch (err: any) {
      console.warn(`[PrismaRepository] getScenarios failed: ${err.message}`);
      return [];
    }
  }

  public async deleteScenario(id: string): Promise<void> {
    if (!this.prisma || !this.isConnected) return;
    try {
      await this.prisma.scenario.deleteMany({ where: { id } });
    } catch (err: any) {
      console.warn(`[PrismaRepository] deleteScenario failed: ${err.message}`);
    }
  }

  // --- Sessions ---
  public async getSessions(): Promise<SimulationSession[]> {
    if (!this.prisma || !this.isConnected) return [];
    const records = await this.prisma.session.findMany();
    return records.map((r: any) => r.data as SimulationSession);
  }

  public deleteSession(id: string): Promise<void> {
    return this.serialize(`session:${id}`, async () => {
      if (!this.prisma || !this.isConnected) return;
      try {
        await this.prisma.session.deleteMany({ where: { id } });
      } catch (err: any) {
        console.warn(`[PrismaRepository] deleteSession failed: ${err.message}`);
      }
    });
  }

  public saveSession(session: SimulationSession): Promise<void> {
    return this.serialize(`session:${session.id}`, () => this.writeSession(session));
  }

  private async writeSession(session: SimulationSession): Promise<void> {
    if (!this.prisma || !this.isConnected) return;
    try {
      await this.prisma.session.upsert({
        where: { id: session.id },
        create: {
          id: session.id,
          name: session.name,
          scenarioId: session.scenarioId,
          state: session.state,
          currentRound: session.currentRound,
          data: session as any,
        },
        update: {
          name: session.name,
          scenarioId: session.scenarioId,
          state: session.state,
          currentRound: session.currentRound,
          data: session as any,
        },
      });
    } catch (err: any) {
      console.warn(`[PrismaRepository] saveSession failed: ${err.message}`);
    }
  }

  // --- Chat Messages ---
  public async getChatMessages(): Promise<Array<{ sessionId: string; teamId: string; message: ChatMessage }>> {
    if (!this.prisma || !this.isConnected) return [];
    const records = await this.prisma.chatMessage.findMany({ orderBy: { createdAt: 'asc' } });
    return records.map((r: any) => ({ sessionId: r.sessionId, teamId: r.teamId, message: r.data as ChatMessage }));
  }

  public async deleteChatMessagesForSession(sessionId: string): Promise<void> {
    if (!this.prisma || !this.isConnected) return;
    try {
      await this.prisma.chatMessage.deleteMany({ where: { sessionId } });
    } catch (err: any) {
      console.warn(`[PrismaRepository] deleteChatMessagesForSession failed: ${err.message}`);
    }
  }

  public async saveChatMessage(sessionId: string, teamId: string, message: ChatMessage): Promise<void> {
    if (!this.prisma || !this.isConnected) return;
    try {
      await this.prisma.chatMessage.upsert({
        where: { id: message.id },
        create: {
          id: message.id,
          sessionId,
          teamId,
          stakeholderId: message.stakeholderId || null,
          sender: message.sender,
          data: message as any,
        },
        update: {
          data: message as any,
        },
      });
    } catch (err: any) {
      console.warn(`[PrismaRepository] saveChatMessage failed: ${err.message}`);
    }
  }

  // --- Simulation Runs ---
  public async getSimulationRuns(): Promise<ArchivedSimulationRun[]> {
    if (!this.prisma || !this.isConnected) return [];
    const records = await this.prisma.simulationRun.findMany();
    return records.map((r: any) => r.data as ArchivedSimulationRun);
  }

  public async saveSimulationRun(run: ArchivedSimulationRun): Promise<void> {
    if (!this.prisma || !this.isConnected) return;
    try {
      await this.prisma.simulationRun.upsert({
        where: { id: run.id },
        create: {
          id: run.id,
          sessionId: run.sessionId,
          scenarioId: run.scenarioId,
          runNumber: run.runNumber,
          title: run.sessionName,
          winnerTeamName: run.winnerTeamName || null,
          totalRounds: run.totalRounds,
          data: run as any,
        },
        update: {
          data: run as any,
        },
      });
    } catch (err: any) {
      console.warn(`[PrismaRepository] saveSimulationRun failed: ${err.message}`);
    }
  }

  // --- BullMQ Job Logging ---
  public async recordJobLog(data: {
    queueName: string;
    jobId: string;
    name: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    payload?: any;
    result?: any;
    error?: string;
  }): Promise<void> {
    if (!this.prisma || !this.isConnected) return;
    try {
      await this.prisma.jobLog.create({
        data: {
          queueName: data.queueName,
          jobId: data.jobId,
          name: data.name,
          status: data.status,
          payload: data.payload ? (data.payload as any) : undefined,
          result: data.result ? (data.result as any) : undefined,
          error: data.error,
        },
      });
    } catch (err: any) {
      console.warn(`[PrismaRepository] recordJobLog failed: ${err.message}`);
    }
  }
}
