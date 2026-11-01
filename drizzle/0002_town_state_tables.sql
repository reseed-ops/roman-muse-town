DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE discoveries (
  collectible_id TEXT PRIMARY KEY,
  found_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
