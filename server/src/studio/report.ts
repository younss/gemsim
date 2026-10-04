// ============================================================================
// GEMSIM STUDIO: PIPELINE REPORT TYPES
// Type-only module shared with the client (no server dependency).
// ============================================================================

import type { CalibrationReport } from './difficulty.js';

/** An element where the author (System 2) and the judge (System 1) disagree. */
export interface ReviewItem {
  element: string;
  author: string;
  judge: string;
  confidence: number;
  kept: 'author' | 'judge';
}

export interface PipelineReport {
  author: string; // LLM provider
  judge: string; // System 1 model, or 'author-tags'
  completions: string[][]; // what had to be asked again
  review: ReviewItem[];
  forced: string[]; // structural fixes made by the engine
  calibration: CalibrationReport;
}
