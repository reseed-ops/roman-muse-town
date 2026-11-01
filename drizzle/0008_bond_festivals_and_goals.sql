CREATE TABLE bond_state (
  id INTEGER PRIMARY KEY,
  bond INTEGER NOT NULL DEFAULT 0,
  level TEXT NOT NULL DEFAULT 'New beginning',
  next_level TEXT NOT NULL DEFAULT 'Kindred',
  next_at INTEGER NOT NULL DEFAULT 500,
  as_of TEXT NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE festivals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sort INTEGER NOT NULL DEFAULT 0,
  month_day TEXT NOT NULL,
  name TEXT NOT NULL,
  dressing TEXT NOT NULL,
  colors TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE goals_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sort INTEGER NOT NULL DEFAULT 0,
  grp TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE goals_meta (
  id INTEGER PRIMARY KEY,
  as_of TEXT NOT NULL DEFAULT ''
);
