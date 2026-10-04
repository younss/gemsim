// ============================================================================
// GEMSIM: SHARED GAME RULES (CLIENT BRIDGE)
// Re-exports the server's pure rule functions so the UI enforces and previews
// exactly the constraints and objectives the server applies.
// ============================================================================

export {
  checkDecisions,
  lockedInitiativeIds,
  getRoundEvent,
  activeBoardMandate,
  describeBoardMandate,
  DEFAULT_MAX_INITIATIVES_PER_ROUND,
} from '../../server/src/engine/rules';
export type { DecisionCheck } from '../../server/src/engine/rules';
export { evaluateOutcome } from '../../server/src/engine/outcome';
export {
  clearMarket,
  effectiveMarketDecision,
  marketShareTarget,
  marketSpend,
  rivalPrice,
  segmentDemand,
  teamPresence,
  productQuality,
  MARKET_PRICE_BOUNDS,
} from '../../server/src/engine/market';
