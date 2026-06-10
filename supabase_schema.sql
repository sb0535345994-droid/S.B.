-- ============================================================
-- שידוכים באמונה — Supabase Schema
-- הרץ את הקובץ הזה ב-Supabase > SQL Editor
-- ============================================================

-- 1. profiles (מחובר ל-auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  phone      TEXT UNIQUE NOT NULL,
  role       TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. shidduch_cards
CREATE TABLE IF NOT EXISTS shidduch_cards (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  first_name   TEXT,
  last_name    TEXT,
  age          TEXT,
  height       TEXT,
  build        TEXT,
  edah         TEXT,
  city         TEXT,
  sector       TEXT,
  marital_status TEXT,
  kids         TEXT,
  kids_detail  TEXT,
  edu          TEXT,
  service      TEXT,
  job          TEXT,
  family_bg    TEXT,
  cover        TEXT,
  touch        TEXT,
  smoke        TEXT,
  phone_type   TEXT,
  about        TEXT,
  looking      TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  is_favorite  BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. managers
CREATE TABLE IF NOT EXISTS managers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL,
  role_title    TEXT DEFAULT '',
  initials      TEXT DEFAULT '',
  is_active     BOOLEAN DEFAULT TRUE,
  display_order INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 4. purchase_packages
CREATE TABLE IF NOT EXISTS purchase_packages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  description        TEXT DEFAULT '',
  price              NUMERIC(10,2) NOT NULL,
  publications_count INT NOT NULL DEFAULT 1,
  marketing_label    TEXT DEFAULT '',
  payment_link       TEXT DEFAULT '',
  is_active          BOOLEAN DEFAULT TRUE,
  is_promo           BOOLEAN DEFAULT FALSE,
  is_popular         BOOLEAN DEFAULT FALSE,
  display_order      INT DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- מיגרציה: הוספת עמודת payment_link אם הטבלה כבר קיימת
ALTER TABLE purchase_packages ADD COLUMN IF NOT EXISTS payment_link TEXT DEFAULT '';

-- 5. vip_settings (שורה אחת תמיד)
CREATE TABLE IF NOT EXISTS vip_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled  BOOLEAN DEFAULT FALSE,
  price       NUMERIC(10,2) DEFAULT 0,
  description TEXT DEFAULT ''
);

-- 6. blocked_users
CREATE TABLE IF NOT EXISTS blocked_users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT,
  email      TEXT,
  reason     TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. site_settings (שורה אחת תמיד)
CREATE TABLE IF NOT EXISTS site_settings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  general_rules        TEXT DEFAULT '',
  announcement_text    TEXT DEFAULT '',
  announcement_enabled BOOLEAN DEFAULT FALSE,
  site_enabled         BOOLEAN DEFAULT TRUE,
  site_closed_message  TEXT DEFAULT 'המערכת סגורה זמנית. נחזור בקרוב.',
  bit_phone            TEXT DEFAULT ''
);

-- מיגרציה: הוספת עמודת bit_phone אם הטבלה כבר קיימת
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS bit_phone TEXT DEFAULT '';
-- מיגרציה: הוספת עמודת publish_enabled
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS publish_enabled BOOLEAN DEFAULT TRUE;

-- 8. user_publication_balances
CREATE TABLE IF NOT EXISTS user_publication_balances (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  available_publications INT NOT NULL DEFAULT 0,
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- נתוני ברירת מחדל
-- ============================================================

INSERT INTO site_settings (id, site_enabled, announcement_enabled)
VALUES (gen_random_uuid(), TRUE, FALSE)
ON CONFLICT DO NOTHING;

INSERT INTO vip_settings (id, is_enabled, price, description)
VALUES (gen_random_uuid(), FALSE, 0, 'שירות VIP')
ON CONFLICT DO NOTHING;

INSERT INTO purchase_packages (name, description, price, publications_count, is_active, display_order)
VALUES
  ('מסלול 1', 'פרסום יחיד בערוץ', 8, 1, TRUE, 1),
  ('מסלול 2', '2 פרסומים בערוץ',  14, 2, TRUE, 2)
ON CONFLICT DO NOTHING;

INSERT INTO managers (name, phone, role_title, initials, is_active, display_order)
VALUES
  ('אלישע', '972535345994', 'מנהל ראשי', 'א', TRUE, 1),
  ('חנה',   '972535346046', 'מנהלת',     'ח', TRUE, 2)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shidduch_cards            ENABLE ROW LEVEL SECURITY;
ALTER TABLE managers                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_packages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_settings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_publication_balances ENABLE ROW LEVEL SECURITY;

-- Helper: בדיקת admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- profiles
CREATE POLICY "user reads own profile"   ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "user updates own profile" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "admin reads all profiles" ON profiles FOR SELECT USING (is_admin());
CREATE POLICY "insert own profile"       ON profiles FOR INSERT WITH CHECK (id = auth.uid());

-- shidduch_cards
CREATE POLICY "user reads own cards"   ON shidduch_cards FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user inserts own cards" ON shidduch_cards FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user updates own cards" ON shidduch_cards FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "user deletes own cards" ON shidduch_cards FOR DELETE USING (user_id = auth.uid());

-- managers (כולם קוראים, רק admin כותב)
CREATE POLICY "all read managers"    ON managers FOR SELECT USING (TRUE);
CREATE POLICY "admin write managers" ON managers FOR ALL USING (is_admin());

-- purchase_packages (כולם קוראים, רק admin כותב)
CREATE POLICY "all read packages"    ON purchase_packages FOR SELECT USING (TRUE);
CREATE POLICY "admin write packages" ON purchase_packages FOR ALL USING (is_admin());

-- vip_settings (כולם קוראים, רק admin כותב)
CREATE POLICY "all read vip"    ON vip_settings FOR SELECT USING (TRUE);
CREATE POLICY "admin write vip" ON vip_settings FOR ALL USING (is_admin());

-- blocked_users (רק admin)
CREATE POLICY "admin manages blocked" ON blocked_users FOR ALL USING (is_admin());

-- site_settings (כולם קוראים, רק admin כותב)
CREATE POLICY "all read settings"    ON site_settings FOR SELECT USING (TRUE);
CREATE POLICY "admin write settings" ON site_settings FOR ALL USING (is_admin());

-- user_publication_balances
CREATE POLICY "user reads own balance"   ON user_publication_balances FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "admin manages balances"   ON user_publication_balances FOR ALL USING (is_admin());
CREATE POLICY "user inserts own balance" ON user_publication_balances FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================
-- trigger: עדכון updated_at אוטומטי
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cards_updated_at
  BEFORE UPDATE ON shidduch_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER balance_updated_at
  BEFORE UPDATE ON user_publication_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- trigger: יצירת profile + balance אוטומטית אחרי signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- צור profile רק אם לא קיים
  INSERT INTO public.profiles (id, first_name, last_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;

  -- צור balance התחלתי
  INSERT INTO public.user_publication_balances (user_id, available_publications)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- הסר trigger קיים אם יש
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- צור trigger חדש
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- policy נוספת: service role יכול להכניס profiles (עבור trigger)
DROP POLICY IF EXISTS "service role insert profile" ON profiles;
CREATE POLICY "service role insert profile" ON profiles
  FOR INSERT WITH CHECK (TRUE);
