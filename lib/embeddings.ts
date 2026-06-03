export async function getEmbedding(text: string): Promise<number[]> {
  // Simple deterministic embedding using character frequency
  const vector = new Array(384).fill(0)
  const words = text.toLowerCase().split(/\s+/)
  
  for (const word of words) {
    for (let i = 0; i < word.length; i++) {
      const idx = (word.charCodeAt(i) * 31 + i * 17) % 384
      vector[idx] += 1
    }
  }
  
  // Normalize
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
  return magnitude > 0 ? vector.map(v => v / magnitude) : vector
}