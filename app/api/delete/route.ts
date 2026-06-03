import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { file_id } = await req.json()

    if (!file_id) {
      return NextResponse.json({ error: 'No file_id provided' }, { status: 400 })
    }

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('file_id', file_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('Delete error:', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}