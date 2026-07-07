-- 食材分類マスタ
CREATE TABLE IF NOT EXISTS ingredient_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 仕入先マスタ
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  closing_day INTEGER, -- 締め日（1-31）
  payment_terms TEXT,  -- 支払条件（例：翌月末）
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 食材マスタ
CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category_id UUID REFERENCES ingredient_categories(id),
  supplier_id UUID REFERENCES suppliers(id),
  unit TEXT NOT NULL DEFAULT 'g',       -- 単位（g, cc, 個, 枚など）
  purchase_price NUMERIC(10,2),         -- 仕入価格（基準）
  purchase_quantity NUMERIC(10,3),      -- 内容量
  yield_rate NUMERIC(5,2) DEFAULT 100, -- 歩留率(%)
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- グループ食材の構成材料（例：酢飯 = 米 + 酢 + 砂糖 + 塩）
CREATE TABLE IF NOT EXISTS ingredient_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  component_ingredient_id UUID REFERENCES ingredients(id),
  component_name TEXT NOT NULL,         -- マスタ未登録でも入力できるよう
  quantity NUMERIC(10,3) NOT NULL,
  unit TEXT NOT NULL,
  unit_price NUMERIC(10,4),             -- 使用時点の単価（スナップショット）
  cost NUMERIC(10,2),                   -- 原価（自動計算）
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 仕入履歴
CREATE TABLE IF NOT EXISTS purchase_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id UUID REFERENCES suppliers(id),
  ingredient_id UUID REFERENCES ingredients(id),
  ingredient_name TEXT NOT NULL,        -- マスタ外の品目も記録できるよう
  quantity NUMERIC(10,3) NOT NULL,
  unit TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,         -- 合計金額
  unit_price NUMERIC(10,4),             -- 単位単価（自動計算）
  invoice_image_url TEXT,               -- 納品書画像URL
  ocr_raw_text TEXT,                    -- OCR生テキスト
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- メニュー
CREATE TABLE IF NOT EXISTS menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,                        -- 料理カテゴリ（前菜・主菜など）
  image_url TEXT,                       -- AI生成イメージ画像（data URL）
  selling_price NUMERIC(10,2) NOT NULL,
  target_cost_rate NUMERIC(5,2) DEFAULT 30, -- 目標原価率(%)
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- メニュー構成食材
CREATE TABLE IF NOT EXISTS menu_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id),
  ingredient_name TEXT NOT NULL,        -- マスタ未登録でも入力できるよう
  quantity NUMERIC(10,3) NOT NULL,
  unit TEXT NOT NULL,
  unit_price NUMERIC(10,4),             -- 使用時点の単価（スナップショット）
  cost NUMERIC(10,2),                   -- 原価（自動計算）
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初期データ：食材分類
INSERT INTO ingredient_categories (name, sort_order) VALUES
  ('魚介類', 1),
  ('肉類', 2),
  ('野菜・キノコ', 3),
  ('米・麺・パン', 4),
  ('調味料・油', 5),
  ('乳製品・卵', 6),
  ('仕込み品', 7),
  ('その他', 8)
ON CONFLICT (name) DO NOTHING;

-- 既存DBにmenusテーブルを作成済みの場合は以下を実行してカラムを追加
-- ALTER TABLE menus ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 仕入履歴から食材マスタの単価を自動更新するビュー
CREATE OR REPLACE VIEW ingredient_latest_price AS
SELECT DISTINCT ON (ingredient_id)
  ingredient_id,
  unit_price,
  price,
  quantity,
  purchase_date
FROM purchase_history
WHERE ingredient_id IS NOT NULL AND unit_price IS NOT NULL
ORDER BY ingredient_id, purchase_date DESC, created_at DESC;
