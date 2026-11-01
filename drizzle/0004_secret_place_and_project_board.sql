CREATE TABLE secret_state (
  id INTEGER PRIMARY KEY,
  first_visit_at INTEGER
);
--> statement-breakpoint
CREATE TABLE board_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sort INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  next_step TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE board_meta (
  id INTEGER PRIMARY KEY,
  as_of TEXT NOT NULL DEFAULT ''
);
