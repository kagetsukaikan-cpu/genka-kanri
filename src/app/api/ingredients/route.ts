import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')

  let query = supabase.from('ingredients').select('*').order('name')
  if (category) query = query.eq('category_id', category)

  const [{ data: ingredients, error }, { data: categories }, { data: suppliers }, { data: latestPrices }, { data: components }] = await Promise.all([
    query,
    supabase.from('ingredient_categories').select('*'),
    supabase.from('suppliers').select('*'),
    supabase.from('ingredient_latest_price').select('ingredient_id, unit_price'),
    supabase.from('ingredient_components').select('parent_ingredient_id'),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const catMap = Object.fromEntries((categories ?? []).map((c: any) => [c.id, c]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supMap = Object.fromEntries((suppliers ?? []).map((s: any) => [s.id, s]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priceMap = Object.fromEntries((latestPrices ?? []).map((p: any) => [p.ingredient_id, p.unit_price]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupIds = new Set((components ?? []).map((c: any) => c.parent_ingredient_id))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = (ingredients ?? []).map((ing: any) => ({
    ...ing,
    category: catMap[ing.category_id] ?? null,
    supplier: supMap[ing.supplier_id] ?? null,
    latest_unit_price: priceMap[ing.id] ?? null,
    is_group: groupIds.has(ing.id),
  }))

  return NextResponse.json(enriched)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { components, ...ingredientData } = body

  if (Array.isArray(components) && components.length > 0) {
    const totalCost = components.reduce((s: number, c: Record<string, unknown>) => s + (Number(c.cost) || 0), 0)
    ingredientData.purchase_price = totalCost
  }

  const { data, error } = await supabase.from('ingredients').insert(ingredientData).select().single()
  if (error) {
    // 同名の食材が既に登録されている場合（一意制約違反）はわかりやすいメッセージに変換する
    const message = error.code === '23505'
      ? 'この食材名は既に登録されています。別の名前にしてください。'
      : error.message
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (Array.isArray(components) && components.length > 0) {
    const rows = components.map((c: Record<string, unknown>, idx: number) => ({
      parent_ingredient_id: data.id,
      component_ingredient_id: c.component_ingredient_id ?? null,
      component_name: c.component_name,
      quantity: c.quantity,
      unit: c.unit,
      unit_price: c.unit_price ?? null,
      cost: c.unit_price && c.quantity ? (c.unit_price as number) * (c.quantity as number) : null,
      sort_order: idx,
    }))
    await supabase.from('ingredient_components').insert(rows)
  }

  return NextResponse.json(data, { status: 201 })
}
