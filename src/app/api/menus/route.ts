import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { computeRowCost } from '@/lib/price'
import type { Ingredient } from '@/types'

export async function GET() {
  // 各メニューの合計原価は「最新の実質単価（歩留り反映済み）」で常に計算する
  const [{ data: menus, error }, { data: miData }, { data: ings }, { data: latest }] = await Promise.all([
    supabase.from('menus').select('*').eq('is_active', true).order('name'),
    supabase.from('menu_ingredients').select('menu_id, ingredient_id, quantity, unit_price, cost'),
    supabase.from('ingredients').select('id, purchase_price, purchase_quantity, yield_rate'),
    supabase.from('ingredient_latest_price').select('ingredient_id, unit_price'),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priceMap = Object.fromEntries((latest ?? []).map((p: any) => [p.ingredient_id, p.unit_price]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ingMap = Object.fromEntries((ings ?? []).map((i: any) => [i.id, { ...i, latest_unit_price: priceMap[i.id] ?? null }])) as Record<string, Ingredient>

  const costMap: Record<string, number> = {}
  for (const mi of miData ?? []) {
    if (!costMap[mi.menu_id]) costMap[mi.menu_id] = 0
    costMap[mi.menu_id] += computeRowCost(mi, ingMap)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (menus ?? []).map((m: any) => ({
    ...m,
    total_cost: costMap[m.id] ?? 0,
    cost_rate: m.selling_price > 0 ? ((costMap[m.id] ?? 0) / m.selling_price) * 100 : 0,
  }))

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { menu_ingredients, image_url: _image_url, ...menuData } = body

  const { data: menu, error: menuError } = await supabase
    .from('menus')
    .insert(menuData)
    .select()
    .single()

  if (menuError) return NextResponse.json({ error: menuError.message }, { status: 400 })

  if (menu_ingredients?.length) {
    const rows = menu_ingredients.map((mi: { ingredient_id?: string; ingredient_name: string; quantity: number; unit: string; unit_price?: number; sort_order?: number }) => ({
      menu_id: menu.id,
      ingredient_id: mi.ingredient_id || null,
      ingredient_name: mi.ingredient_name,
      quantity: mi.quantity,
      unit: mi.unit,
      unit_price: mi.unit_price ?? null,
      cost: mi.unit_price ? mi.quantity * mi.unit_price : null,
      sort_order: mi.sort_order ?? 0,
    }))
    await supabase.from('menu_ingredients').insert(rows)
  }

  return NextResponse.json(menu, { status: 201 })
}
