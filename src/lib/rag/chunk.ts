export type Chunk = { page: number; chunkIndex: number; content: string };

// Naive fixed-size chunking, per page so every chunk keeps its PDF page number.
export function chunkPages(pages: string[], size: number, overlap: number): Chunk[] {
  const step = size - overlap;
  const out: Chunk[] = [];
  pages.forEach((raw, i) => {
    const text = raw.replace(/\s+/g, " ").trim();
    for (let start = 0; start < text.length; start += step) {
      out.push({ page: i + 1, chunkIndex: out.length, content: text.slice(start, start + size) });
      if (start + size >= text.length) break;
    }
  });
  return out;
}
