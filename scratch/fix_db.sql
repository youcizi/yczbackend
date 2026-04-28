CREATE TABLE IF NOT EXISTS p_member_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  member_id TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT,
  phone TEXT,
  tier_id INTEGER,
  account_type TEXT DEFAULT 'individual' NOT NULL,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS p_member_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  member_id TEXT NOT NULL,
  country_code TEXT DEFAULT 'CN' NOT NULL,
  province TEXT,
  city TEXT,
  district TEXT,
  detail TEXT NOT NULL,
  is_default INTEGER DEFAULT 0 NOT NULL,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS p_member_tiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  discount_rate INTEGER DEFAULT 100 NOT NULL,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS p_member_tiers_i18n (
  tier_id INTEGER NOT NULL,
  lang_code TEXT NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (tier_id, lang_code)
);
