// ============================================================================
// GEMSIM: PERSISTENCE & DATABASE REPOSITORY
// SQLite ACID persistence with automatic migrations and seed data
// ============================================================================

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Scenario, SimulationSession, ChatMessage } from '../types/index.js';
import { SEED_SCENARIOS } from './seeds.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DatabaseRepository {
  private static instance: DatabaseRepository;
  private db: Database.Database;

  private constructor() {
    const dataDir = process.env.DATA_DIR || path.resolve(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = process.env.DB_PATH || path.join(dataDir, 'gemsim.db');
    console.log(`[DatabaseRepository] Connecting to SQLite database at: ${dbPath}`);

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    this.initTables();
    this.seedDefaults();
  }

  public static getInstance(): DatabaseRepository {
    if (!DatabaseRepository.instance) {
      DatabaseRepository.instance = new DatabaseRepository();
    }
    return DatabaseRepository.instance;
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scenarios (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        industry TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        scenario_id TEXT NOT NULL,
        state TEXT NOT NULL,
        current_round INTEGER NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        team_id TEXT NOT NULL,
        stakeholder_id TEXT,
        sender TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_scenario ON sessions(scenario_id);
      CREATE INDEX IF NOT EXISTS idx_chat_session_team ON chat_messages(session_id, team_id);
    `);
  }

  private seedDefaults() {
    const countRow = this.db.prepare('SELECT COUNT(*) as count FROM scenarios').get() as { count: number };
    if (countRow.count === 0) {
      console.log(`[DatabaseRepository] Seeding ${SEED_SCENARIOS.length} initial enterprise scenarios...`);
      const insert = this.db.prepare(`
        INSERT INTO scenarios (id, title, industry, is_default, data, created_at, updated_at)
        VALUES (?, ?, ?, 1, ?, ?, ?)
      `);

      const tx = this.db.transaction((scenarios: Scenario[]) => {
        for (const s of scenarios) {
          const now = new Date().toISOString();
          insert.run(s.id, s.title, s.industry, JSON.stringify(s), now, now);
        }
      });

      tx(SEED_SCENARIOS);
      console.log(`[DatabaseRepository] Pre-seeded scenarios ready.`);
    }
  }

  // --- Scenarios ---

  public getScenarios(): Scenario[] {
    const rows = this.db.prepare('SELECT data FROM scenarios ORDER BY is_default DESC, created_at DESC').all() as Array<{ data: string }>;
    return rows.map(r => JSON.parse(r.data));
  }

  public getScenario(id: string): Scenario | null {
    const row = this.db.prepare('SELECT data FROM scenarios WHERE id = ?').get(id) as { data: string } | undefined;
    return row ? JSON.parse(row.data) : null;
  }

  public saveScenario(scenario: Scenario): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO scenarios (id, title, industry, is_default, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        industry = excluded.industry,
        data = excluded.data,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      scenario.id,
      scenario.title,
      scenario.industry,
      scenario.isDefault ? 1 : 0,
      JSON.stringify(scenario),
      scenario.createdAt || now,
      now
    );
  }

  public deleteScenario(id: string): boolean {
    const res = this.db.prepare('DELETE FROM scenarios WHERE id = ? AND is_default = 0').run(id);
    return res.changes > 0;
  }

  // --- Sessions ---

  public getSessions(): SimulationSession[] {
    const rows = this.db.prepare('SELECT data FROM sessions ORDER BY updated_at DESC').all() as Array<{ data: string }>;
    return rows.map(r => JSON.parse(r.data));
  }

  public getSession(id: string): SimulationSession | null {
    const row = this.db.prepare('SELECT data FROM sessions WHERE id = ?').get(id) as { data: string } | undefined;
    return row ? JSON.parse(row.data) : null;
  }

  public saveSession(session: SimulationSession): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, name, scenario_id, state, current_round, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        scenario_id = excluded.scenario_id,
        state = excluded.state,
        current_round = excluded.current_round,
        data = excluded.data,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      session.id,
      session.name,
      session.scenarioId,
      session.state,
      session.currentRound,
      JSON.stringify(session),
      session.createdAt || now,
      now
    );
  }

  public deleteSession(id: string): boolean {
    this.db.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(id);
    const res = this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
    return res.changes > 0;
  }

  // --- Chat Messages ---

  public getChatMessages(sessionId: string, teamId: string, stakeholderId?: string): ChatMessage[] {
    let sql = 'SELECT data FROM chat_messages WHERE session_id = ? AND team_id = ?';
    const params: any[] = [sessionId, teamId];

    if (stakeholderId) {
      sql += ' AND (stakeholder_id = ? OR stakeholder_id IS NULL)';
      params.push(stakeholderId);
    }
    sql += ' ORDER BY created_at ASC';

    const rows = this.db.prepare(sql).all(...params) as Array<{ data: string }>;
    return rows.map(r => JSON.parse(r.data));
  }

  public saveChatMessage(sessionId: string, teamId: string, message: ChatMessage): void {
    const now = message.timestamp || new Date().toISOString();
    this.db.prepare(`
      INSERT INTO chat_messages (id, session_id, team_id, stakeholder_id, sender, data, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      message.id,
      sessionId,
      teamId,
      message.stakeholderId || null,
      message.sender,
      JSON.stringify(message),
      now
    );
  }
}
