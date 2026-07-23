-- Core BGG tables
CREATE TABLE IF NOT EXISTS games (
  bgg_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  year_published INTEGER,
  min_players INTEGER,
  max_players INTEGER,
  playing_time INTEGER,
  min_play_time INTEGER,
  max_play_time INTEGER,
  weight REAL,
  image_url TEXT,
  thumbnail_url TEXT,
  designers TEXT,
  mechanics TEXT,
  categories TEXT,
  bgg_rating REAL,
  bgg_rank INTEGER,
  thing_synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collection_entries (
  coll_id INTEGER PRIMARY KEY,
  bgg_id INTEGER NOT NULL,
  subtype TEXT NOT NULL,
  name TEXT NOT NULL,
  year_published INTEGER,
  image_url TEXT,
  thumbnail_url TEXT,
  own INTEGER NOT NULL DEFAULT 0,
  prev_owned INTEGER NOT NULL DEFAULT 0,
  for_trade INTEGER NOT NULL DEFAULT 0,
  want INTEGER NOT NULL DEFAULT 0,
  want_to_play INTEGER NOT NULL DEFAULT 0,
  want_to_buy INTEGER NOT NULL DEFAULT 0,
  wishlist INTEGER NOT NULL DEFAULT 0,
  preordered INTEGER NOT NULL DEFAULT 0,
  has_parts INTEGER NOT NULL DEFAULT 0,
  want_parts INTEGER NOT NULL DEFAULT 0,
  personal_rating REAL,
  comment TEXT,
  wishlist_priority INTEGER,
  num_plays INTEGER NOT NULL DEFAULT 0,
  bgg_rating REAL,
  bgg_rank INTEGER,
  last_modified TEXT,
  synced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_collection_bgg_id ON collection_entries(bgg_id);
CREATE INDEX IF NOT EXISTS idx_collection_own ON collection_entries(own);
CREATE INDEX IF NOT EXISTS idx_collection_wishlist ON collection_entries(wishlist);

CREATE TABLE IF NOT EXISTS plays (
  play_id INTEGER PRIMARY KEY,
  bgg_id INTEGER NOT NULL,
  game_name TEXT NOT NULL,
  date TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  length INTEGER NOT NULL DEFAULT 0,
  location TEXT NOT NULL DEFAULT '',
  incomplete INTEGER NOT NULL DEFAULT 0,
  nowinstats INTEGER NOT NULL DEFAULT 0,
  comments TEXT,
  synced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plays_date ON plays(date);
CREATE INDEX IF NOT EXISTS idx_plays_bgg_id_date ON plays(bgg_id, date);

CREATE TABLE IF NOT EXISTS play_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  play_id INTEGER NOT NULL,
  username TEXT NOT NULL DEFAULT '',
  userid INTEGER,
  name TEXT NOT NULL DEFAULT '',
  score TEXT NOT NULL DEFAULT '',
  win INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '',
  rating INTEGER,
  FOREIGN KEY (play_id) REFERENCES plays(play_id) ON DELETE CASCADE,
  UNIQUE(play_id, username, name)
);

CREATE TABLE IF NOT EXISTS sync_state (
  resource TEXT PRIMARY KEY,
  last_synced_at TEXT NOT NULL,
  metadata TEXT
);

-- Activity: duel ranking
CREATE TABLE IF NOT EXISTS duel_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_from TEXT NOT NULL,
  period_to TEXT NOT NULL,
  min_plays INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  winner_bgg_id INTEGER,
  remaining_bgg_ids TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS duel_rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  round_number INTEGER NOT NULL,
  candidate_a_bgg_id INTEGER NOT NULL,
  candidate_b_bgg_id INTEGER NOT NULL,
  winner_bgg_id INTEGER NOT NULL,
  decided_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES duel_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_duel_rounds_session ON duel_rounds(session_id);
