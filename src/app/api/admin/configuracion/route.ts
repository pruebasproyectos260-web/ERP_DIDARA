import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('configuracion').select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest) {
  const authClient = await createClient()
  const supabase = createServiceClient()
  const body = await req.json()
  const { data: { user } } = await authClient.auth.getUser()

  const { data, error } = await supabase
    .from('configuracion')
    .update({ ...body, updated_by: user!.id, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
