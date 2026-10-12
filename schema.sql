-- ひるしか v0.73-trial / Cloudflare D1
CREATE TABLE IF NOT EXISTS trial_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tester_id TEXT NOT NULL,
  session_id TEXT,
  event_type TEXT NOT NULL,
  event_timestamp TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  meal_duration_sec INTEGER NOT NULL DEFAULT 0,
  reached_15min INTEGER NOT NULL DEFAULT 0,
  finished INTEGER NOT NULL DEFAULT 0,
  memo_present INTEGER NOT NULL DEFAULT 0,
  road_opened INTEGER NOT NULL DEFAULT 0,
  menu_choice_used INTEGER NOT NULL DEFAULT 0,
  chew_done INTEGER NOT NULL DEFAULT 0,
  detour_done INTEGER NOT NULL DEFAULT 0,
  resumed_after_background INTEGER NOT NULL DEFAULT 0,
  extra_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_trial_events_tester ON trial_events(tester_id);
CREATE INDEX IF NOT EXISTS idx_trial_events_session ON trial_events(session_id);
CREATE INDEX IF NOT EXISTS idx_trial_events_type ON trial_events(event_type);
CREATE INDEX IF NOT EXISTS idx_trial_events_time ON trial_events(event_timestamp);
