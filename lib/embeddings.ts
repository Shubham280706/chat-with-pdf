let pipeline: any = null

export async function getEmbedding(text: string): Promise<number[]> {
  if (!pipeline) {
    const { pipeline: createPipeline } = await import('@xenova/transformers')
    pipeline = await createPipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  }

  const output = await pipeline(text, {
    pooling: 'mean',
    normalize: true,
  })

  return Array.from(output.data) as number[]
}