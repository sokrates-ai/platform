/**
 * Lightweight, dependency-free fuzzy search.
 *
 * Scores each item's text against a query using a subsequence match with
 * boosts for exact matches, prefixes and word boundaries. Returns the top
 * `limit` items sorted by score (best first). An empty query returns the
 * first `limit` items unchanged.
 */

function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase()
  const t = text.toLowerCase()

  if (!q) return 0
  if (t === q) return 1000
  if (t.startsWith(q)) return 800
  const wordBoundaryHit = t.split(/\s+/).some((word) => word.startsWith(q))
  if (wordBoundaryHit) return 700
  if (t.includes(q)) return 600

  // Subsequence match: every char of the query appears in order.
  let score = 0
  let queryIndex = 0
  let previousMatchIndex = -1

  for (let i = 0; i < t.length && queryIndex < q.length; i++) {
    if (t[i] === q[queryIndex]) {
      // Reward consecutive matches to prefer tight, contiguous hits.
      score += previousMatchIndex === i - 1 ? 10 : 3
      previousMatchIndex = i
      queryIndex++
    }
  }

  // Only a match if the whole query was consumed.
  return queryIndex === q.length ? score : -1
}

export function fuzzyFilter<T>(
  query: string,
  items: T[],
  getText: (item: T) => string,
  limit: number
): T[] {
  const q = query.trim()

  if (!q) {
    return items.slice(0, limit)
  }

  return items
    .map((item) => ({ item, score: fuzzyScore(q, getText(item)) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item)
}
