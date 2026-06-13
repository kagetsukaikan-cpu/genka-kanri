import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')

  let query = supabase.from('ingredients').select('*').order('name')
  if (category) query = query.eq('category_id', category)

  const [{ data: ingredients, error }, { data: categories }, { data: suppliers }, { data: latestPrices }] = await Promise.all([
    query,
    supabase.from('ingredient_categories').select('*'),
    supabase.from('suppliers').select('*'),
    supabase.from('ingredient_latest_price').select('ingredient_id, unit_price'),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const catMap = Object.fromEntries((categories ?? []).map((c: any) => [c.id, c]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supMap = Object.fromEntries((suppliers ?? []).map((s: any) => [s.id, s]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priceMap = Object.fromEntries((latestPrices ?? []).map((p: any) => [p.ingredient_id, p.unit_price]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = (ingredients ?? []).map((ing: any) => ({
    ...ing,
    category: catMap[ing.category_id] ?? null,
    supplier: supMap[ing.supplier_id] ?? null,
    latest_unit_price: priceMap[ing.id] ?? null,
  }))

  return NextResponse.json(enriched)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { data, error } = await supabase.from('ingredients').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
