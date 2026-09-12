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

  private constructor() {
    if (process.env.DATABASE_URL) {
      try {
        this.prisma = getPrismaClient();
        this.prisma.$connect()
          .then(() => {
            this.isConnected = true;
            console.log('[PrismaRepository] Connected to PostgreSQL via Prisma ORM.');
          })
          .catch((err) => {
            console.warn(`[PrismaRepository] PostgreSQL connection deferred: ${err.message}`);
            this.isConnected = false;
          });
      } catch (err: any) {
        console.warn(`[PrismaRepository] Initialization warning: ${err.message}`);
      }
    }
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

  // --- Sessions ---
  public async saveSession(session: SimulationSession): Promise<void> {
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
