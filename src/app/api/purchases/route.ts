import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const supplierId = searchParams.get('supplier_id')

  let query = supabase.from('purchase_history').select('*')
    .order('purchase_date', { ascending: false })

  if (from) query = query.gte('purchase_date', from)
  if (to) query = query.lte('purchase_date', to)
  if (supplierId) query = query.eq('supplier_id', supplierId)

  const [{ data: purchases, error }, { data: suppliers }, { data: ingredients }] = await Promise.all([
    query.limit(200),
    supabase.from('suppliers').select('*'),
    supabase.from('ingredients').select('*'),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supMap = Object.fromEntries((suppliers ?? []).map((s: any) => [s.id, s]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ingMap = Object.fromEntries((ingredients ?? []).map((i: any) => [i.id, i]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = (purchases ?? []).map((p: any) => ({
    ...p,
    supplier: supMap[p.supplier_id] ?? null,
    ingredient: ingMap[p.ingredient_id] ?? null,
  }))

  return NextResponse.json(enriched)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (body.quantity && body.price && !body.unit_price) {
    body.unit_price = body.price / body.quantity
  }
  const { data, error } = await supabase.from('purchase_history').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
