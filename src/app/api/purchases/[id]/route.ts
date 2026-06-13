import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type Context = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, { params }: Context) {
  const { id } = await params
  const { error } = await supabase.from('purchase_history').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return new NextResponse(null, { status: 204 })
}
