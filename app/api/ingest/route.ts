import { NextRequest, NextResponse } from 'next/server'
import { chunkText } from '@/lib/chunker'
import { getEmbedding } from '@/lib/embeddings'
import { supabase } from '@/lib/supabase'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { extractText } = await import('unpdf')
   const { text } = await extractText(new Uint8Array(buffer))
const rawText = Array.isArray(text) ? text.join(' ') : text

if (!rawText || rawText.trim().length === 0) {
  return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 400 })
}

const chunks = chunkText(rawText)
    const filename = file.name
    const file_id = randomUUID()
    let stored = 0

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const embedding = await getEmbedding(chunk)

      const { error } = await supabase.from('documents').insert({
        content: chunk,
        embedding,
        file_id,
        metadata: { filename, chunkIndex: i, totalChunks: chunks.length }
      })

      if (error) {
        console.error('Supabase insert error:', error)
      } else {
        stored++
      }
    }

    return NextResponse.json({
      success: true,
      filename,
      file_id,
      totalChunks: chunks.length,
      stored
    })

  } catch (err) {
    console.error('Ingest error:', err)
    return NextResponse.json({ error: 'Failed to process PDF' }, { status: 500 })
  }
}