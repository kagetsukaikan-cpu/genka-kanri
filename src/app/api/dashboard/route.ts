import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const [menus, ingredients, suppliers, purchases, menuIngredients] = await Promise.all([
    supabase.from('menus').select('id, name, selling_price, target_cost_rate').eq('is_active', true),
    supabase.from('ingredients').select('id', { count: 'exact', head: true }),
    supabase.from('suppliers').select('id', { count: 'exact', head: true }),
    supabase.from('purchase_history').select('price').gte('purchase_date', firstOfMonth),
    supabase.from('menu_ingredients').select('menu_id, cost'),
  ])

  const menuCostMap: Record<string, number> = {}
  for (const mi of menuIngredients.data ?? []) {
    if (!menuCostMap[mi.menu_id]) menuCostMap[mi.menu_id] = 0
    menuCostMap[mi.menu_id] += mi.cost ?? 0
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
