CREATE TABLE quests_state (
  quest_id TEXT PRIMARY KEY,
  done_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE achievements (
  achievement_id TEXT PRIMARY KEY,
  unlocked_at INTEGER NOT NULL
);
