import { NextRequest, NextResponse } from 'next/server'
import { getEmbedding } from '@/lib/embeddings'
import { supabase } from '@/lib/supabase'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json()

    if (!question || question.trim().length === 0) {
      return NextResponse.json({ error: 'No question provided' }, { status: 400 })
    }

    const questionEmbedding = await getEmbedding(question)

    const { data: chunks, error } = await supabase.rpc('match_documents', {
      query_embedding: questionEmbedding,
      match_threshold: 0.0,
      match_count: 20
    })

    if (error) {
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({
        answer: 'I could not find relevant information in the uploaded PDFs.',
        sources: []
      })
    }

    // Hard limit — max 3 chunks per PDF so no single PDF dominates
    const chunksByFile = new Map<string, any[]>()
    for (const chunk of chunks) {
      const fname = chunk.metadata?.filename || 'unknown'
      if (!chunksByFile.has(fname)) chunksByFile.set(fname, [])
      if (chunksByFile.get(fname)!.length < 3) {
        chunksByFile.get(fname)!.push(chunk)
      }
    }

    const balancedChunks = Array.from(chunksByFile.values()).flat()

    const context = balancedChunks
      .map((c: any, i: number) => `[Source ${i + 1} - "${c.metadata?.filename}"]:\n${c.content}`)
      .join('\n\n---\n\n')

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that answers questions based on the provided PDF content.
You have access to multiple PDFs — each chunk is labeled with its source filename.
When the user mentions a specific document, chapter, or filename, focus ONLY on chunks from that document.
Always mention which document your answer comes from.
If the specific document content is not in the provided context, say so clearly.
Do not make up information.`
        },
        {
          role: 'user',
          content: `Context from PDFs:\n\n${context}\n\nQuestion: ${question}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1024,
    })

    const answer = completion.choices[0]?.message?.content || 'No response generated.'

    const sources = balancedChunks.map((c: any) => ({
      filename: c.metadata?.filename,
      chunk: c.content.slice(0, 150) + '...'
    }))

    return NextResponse.json({ answer, sources })

  } catch (err) {
    console.error('Chat error:', err)
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 })
  }
}