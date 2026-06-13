import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type Context = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Context) {
  const { id } = await params
  const [{ data: ing, error }, { data: categories }, { data: suppliers }] = await Promise.all([
    supabase.from('ingredients').select('*').eq('id', id).single(),
    supabase.from('ingredient_categories').select('*'),
    supabase.from('suppliers').select('*'),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const catMap = Object.fromEntries((categories ?? []).map((c: any) => [c.id, c]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supMap = Object.fromEntries((suppliers ?? []).map((s: any) => [s.id, s]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = ing as any

  return NextResponse.json({
    ...ing,
    category: catMap[r.category_id as string] ?? null,
    supplier: supMap[r.supplier_id as string] ?? null,
  })
}

export async function PUT(request: NextRequest, { params }: Context) {
  const { id } = await params
  const body = await request.json()
  const { data, error } = await supabase
    .from('ingredients')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const { id } = await params
  const { error } = await supabase.from('ingredients').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return new NextResponse(null, { status: 204 })
}
