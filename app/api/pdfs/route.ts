import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('file_id, metadata')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group by file_id
    const fileMap = new Map<string, { filename: string, chunks: number }>()

    for (const row of data) {
      const file_id = row.file_id
      const filename = row.metadata?.filename || 'Unknown'

      if (!file_id) continue

      if (fileMap.has(file_id)) {
        fileMap.get(file_id)!.chunks += 1
      } else {
        fileMap.set(file_id, { filename, chunks: 1 })
      }
    }

    const files = Array.from(fileMap.entries()).map(([file_id, val]) => ({
      file_id,
      filename: val.filename,
      chunks: val.chunks
    }))

    return NextResponse.json({ files })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch PDFs' }, { status: 500 })
  }
}