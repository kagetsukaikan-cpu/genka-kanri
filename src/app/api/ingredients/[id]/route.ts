import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type Context = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Context) {
  const { id } = await params
  const [{ data: ing, error }, { data: categories }, { data: suppliers }, { data: components }] = await Promise.all([
    supabase.from('ingredients').select('*').eq('id', id).single(),
    supabase.from('ingredient_categories').select('*'),
    supabase.from('suppliers').select('*'),
    supabase.from('ingredient_components').select('*').eq('parent_ingredient_id', id).order('sort_order'),
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
    components: components ?? [],
  })
}

export async function PUT(request: NextRequest, { params }: Context) {
  const { id } = await params
  const body = await request.json()
  const { components, ...ingredientData } = body

  if (Array.isArray(components) && components.length > 0) {
    const totalCost = components.reduce((s: number, c: Record<string, unknown>) => s + (Number(c.cost) || 0), 0)
    ingredientData.purchase_price = totalCost
  }

  const { data, error } = await supabase
    .from('ingredients')
    .update({ ...ingredientData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    // 同名の食材が既に登録されている場合（一意制約違反）はわかりやすいメッセージに変換する
    const message = error.code === '23505'
      ? 'この食材名は既に登録されています。別の名前にしてください。'
      : error.message
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (components !== undefined) {
    await supabase.from('ingredient_components').delete().eq('parent_ingredient_id', id)
    if (components.length) {
      const rows = components.map((c: Record<string, unknown>, idx: number) => ({
        parent_ingredient_id: id,
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
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const { id } = await params
  const { error } = await supabase.from('ingredients').delete().eq('id', id)
  if (error) {
    // 外部キー制約違反（メニュー・他の食材グループで使用中）はわかりやすいメッセージに変換する
    const message = error.code === '23503'
      ? 'この食材はメニューまたは他の食材（材料リスト）で使われているため削除できません。先にメニュー・材料リストから外してください。'
      : error.message
    return NextResponse.json({ error: message }, { status: 400 })
  }
  return new NextResponse(null, { status: 204 })
}
