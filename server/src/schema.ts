// The town's tables, on whichever engine this process runs.
//
// schema.sqlite.ts is the source of truth and the type the action layer
// is written against; schema.pg.ts is its Postgres mirror. The engine is
// chosen once per process (storage.ts, TOWN_DIALECT): the artifact runtime
// and the Android build never set it and get SQLite; the web server sets
// postgres and gets the pg-core tables under the same names and, by the
// cast below, the same types. The query builder the actions use is
// dialect-neutral (see storage.ts), which is what makes the cast honest;
// postgres.test.ts runs the actions on both engines to keep it so.
//
// This module exports tables only: saveService reflects over
// Object.values(schema).

import * as pg from "./schema.pg";
import * as sqlite from "./schema.sqlite";
import { townDialect } from "./storage";

const tables = (townDialect() === "postgres" ? pg : sqlite) as typeof sqlite;

export const {
  requestReceipts,
  discoveries,
  journal,
  secretState,
  boardEntries,
  boardMeta,
  questsState,
  achievements,
  letters,
  postcards,
  bondState,
  festivals,
  goalsEntries,
  goalsMeta,
  museNotes,
  affectionState,
  purseState,
  catches,
  bathsState,
  piscinaState,
  gardenState,
  phoenixState,
  challengesState,
  inscriptionsState,
  summitState,
  dreamState,
  linePools,
  chatRing,
  aeliaFacts,
  lifeDigest,
  continuityState,
  taskCompanion,
  forageState,
  bottles,
  bouquets,
  datingState,
  sentimentState,
  heartState,
  treeState,
  readingState,
  seedLedger,
} = tables;
