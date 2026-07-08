import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { computeRowCost } from '@/lib/price'
import type { Ingredient } from '@/types'

export async function GET() {
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const [menus, ingredients, suppliers, purchases, menuIngredients, ingRows, latestPrices] = await Promise.all([
    supabase.from('menus').select('id, name, selling_price, target_cost_rate').eq('is_active', true),
    supabase.from('ingredients').select('id', { count: 'exact', head: true }),
    supabase.from('suppliers').select('id', { count: 'exact', head: true }),
    supabase.from('purchase_history').select('price').gte('purchase_date', firstOfMonth),
    supabase.from('menu_ingredients').select('menu_id, ingredient_id, quantity, unit_price, cost'),
    supabase.from('ingredients').select('id, purchase_price, purchase_quantity, yield_rate'),
    supabase.from('ingredient_latest_price').select('ingredient_id, unit_price'),
  ])

  // 合計原価は「最新の実質単価（歩留り反映済み）」で常に計算する
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priceMap = Object.fromEntries((latestPrices.data ?? []).map((p: any) => [p.ingredient_id, p.unit_price]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ingMap = Object.fromEntries((ingRows.data ?? []).map((i: any) => [i.id, { ...i, latest_unit_price: priceMap[i.id] ?? null }])) as Record<string, Ingredient>

  const menuCostMap: Record<string, number> = {}
  for (const mi of menuIngredients.data ?? []) {
    if (!menuCostMap[mi.menu_id]) menuCostMap[mi.menu_id] = 0
    menuCostMap[mi.menu_id] += computeRowCost(mi, ingMap)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const menuStats = (menus.data ?? []).map((m: any) => {
    const total_cost = menuCostMap[m.id] ?? 0
    const cost_rate = m.selling_price > 0 ? (total_cost / m.selling_price) * 100 : 0
    return { ...m, total_cost, cost_rate }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const purchaseThisMonth = (purchases.data ?? []).reduce((sum: number, p: any) => sum + (p.price ?? 0), 0)

  return NextResponse.json({
    menuCount: menus.data?.length ?? 0,
    ingredientCount: ingredients.count ?? 0,
    supplierCount: suppliers.count ?? 0,
    purchaseThisMonth,
    menus: menuStats,
  })
}
