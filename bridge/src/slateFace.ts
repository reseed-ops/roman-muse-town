/**
 * Adapter B's held snapshot and queue live in shared/slateFace.ts since
 * Task 8: the hosted town (web/) holds one per visitor behind its own
 * director door, and the bridge holds one behind bridgeServer.ts.
 */
export { createSlateFace, readStateView } from "../../shared/slateFace.js";
export type { IntakeResult, SlateFace, SlateFaceOptions } from "../../shared/slateFace.js";
