import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type Context = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Context) {
  const { id } = await params

  const [{ data: menu, error: menuErr }, { data: mis }, { data: ings }] = await Promise.all([
    supabase.from('menus').select('*').eq('id', id).single(),
    supabase.from('menu_ingredients').select('*').eq('menu_id', id).order('sort_order'),
    supabase.from('ingredients').select('*'),
  ])

  if (menuErr) return NextResponse.json({ error: menuErr.message }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ingMap = Object.fromEntries((ings ?? []).map((i: any) => [i.id, i]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const menuIngredients = (mis ?? []).map((mi: any) => ({
    ...mi,
    ingredient: ingMap[mi.ingredient_id] ?? null,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const total_cost = menuIngredients.reduce((s: number, mi: any) => s + (mi.cost ?? 0), 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = menu as any
  const cost_rate = m.selling_price > 0 ? (total_cost / m.selling_price) * 100 : 0

  return NextResponse.json({ ...menu, menu_ingredients: menuIngredients, total_cost, cost_rate })
}

export async function PUT(request: NextRequest, { params }: Context) {
  const { id } = await params
  const body = await request.json()
  const { menu_ingredients, ...menuData } = body

  const { data: menu, error: menuError } = await supabase
    .from('menus')
    .update({ ...menuData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (menuError) return NextResponse.json({ error: menuError.message }, { status: 400 })

  if (menu_ingredients !== undefined) {
    await supabase.from('menu_ingredients').delete().eq('menu_id', id)
    if (menu_ingredients.length) {
      const rows = menu_ingredients.map((mi: Record<string, unknown>, idx: number) => ({
        menu_id: id,
        ingredient_id: mi.ingredient_id ?? null,
        ingredient_name: mi.ingredient_name,
        quantity: mi.quantity,
        unit: mi.unit,
        unit_price: mi.unit_price ?? null,
        cost: mi.unit_price && mi.quantity ? (mi.unit_price as number) * (mi.quantity as number) : null,
        sort_order: idx,
      }))
      await supabase.from('menu_ingredients').insert(rows)
    }
  }

  return NextResponse.json(menu)
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const { id } = await params
  const { error } = await supabase.from('menus')
    .update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return new NextResponse(null, { status: 204 })
}
