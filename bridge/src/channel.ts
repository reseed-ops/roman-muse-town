/**
 * The director channel: the types live in shared/visitChannel.ts since
 * Task 8 (the hosted town serves the same face). Re-exported here so
 * the bridge's own modules keep their import.
 */
export type { ChannelState, DirectResult, DirectorChannel } from "../../shared/visitChannel.js";
