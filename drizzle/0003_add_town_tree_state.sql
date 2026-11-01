CREATE TABLE tree_state (
  id INTEGER PRIMARY KEY,
  planted_at INTEGER NOT NULL,
  waterings INTEGER NOT NULL DEFAULT 0,
  last_watered_at INTEGER
);
