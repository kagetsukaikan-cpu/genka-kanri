export interface IngredientCategory {
  id: string
  name: string
  sort_order: number
  created_at: string
}

export interface Supplier {
  id: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  closing_day: number | null
  payment_terms: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Ingredient {
  id: string
  name: string
  category_id: string | null
  supplier_id: string | null
  unit: string
  purchase_price: number | null
  purchase_quantity: number | null
  yield_rate: number
  notes: string | null
  created_at: string
  updated_at: string
  // joined
  category?: IngredientCategory
  supplier?: Supplier
  latest_unit_price?: number | null
}

export interface PurchaseHistory {
  id: string
  purchase_date: string
  supplier_id: string | null
  ingredient_id: string | null
  ingredient_name: string
  quantity: number
  unit: string
  price: number
  unit_price: number | null
  invoice_image_url: string | null
  ocr_raw_text: string | null
  notes: string | null
  created_at: string
  // joined
  supplier?: Supplier
  ingredient?: Ingredient
}

export interface Menu {
  id: string
  name: string
  category: string | null
  selling_price: number
  target_cost_rate: number
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // computed
  total_cost?: number
  cost_rate?: number
  menu_ingredients?: MenuIngredient[]
}

export interface MenuIngredient {
  id: string
  menu_id: string
  ingredient_id: string | null
  ingredient_name: string
  quantity: number
  unit: string
  unit_price: number | null
  cost: number | null
  sort_order: number
  created_at: string
  // joined
  ingredient?: Ingredient
}

export interface OcrResult {
  items: OcrItem[]
  supplier_name?: string
  purchase_date?: string
  raw_text: string
}

export interface OcrItem {
  name: string
  quantity: number
  unit: string
  price: number
}
