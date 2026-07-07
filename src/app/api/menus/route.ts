import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data: menus, error } = await supabase
    .from('menus')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 各メニューの合計原価を計算
  const { data: miData } = await supabase
    .from('menu_ingredients')
    .select('menu_id, cost')

  const costMap: Record<string, number> = {}
  for (const mi of miData ?? []) {
    if (!costMap[mi.menu_id]) costMap[mi.menu_id] = 0
    costMap[mi.menu_id] += mi.cost ?? 0
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
