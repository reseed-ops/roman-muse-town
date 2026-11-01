CREATE TABLE letters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date_label TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at INTEGER
);
--> statement-breakpoint
CREATE TABLE postcards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blob_key TEXT NOT NULL,
  caption TEXT NOT NULL,
  date_label TEXT NOT NULL,
  weather TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
