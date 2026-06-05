// Tiny hand-rolled fuzzy matcher — no dependency, in keeping with the repo's
// hand-rolled ethos (cf. ArrowLines). It scores how well a query subsequence
// fits a candidate string; the search palette ranks records by this score.
//
// Returns a numeric score (higher = better) when every query char appears in
// order inside the text, or -1 when it doesn't match at all. The score rewards
// contiguous runs and matches at word boundaries, so "kapi" surfaces
// "kube-apiserver" and "cgrp" surfaces "cgroup" ahead of incidental hits.

const BOUNDARY = /[\s\-_/.:()[\]]/

export function fuzzyScore(query, text) {
  if (!query) return 0
  if (!text) return -1
  const q = query.toLowerCase()
  const t = text.toLowerCase()

  let qi = 0
  let score = 0
  let run = 0
  let prevIdx = -2

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) continue
    let bonus = 1
    if (ti === prevIdx + 1) {
      // Contiguous with the previous match — the longer the run, the better.
      run += 1
      bonus += run * 3
    } else {
      run = 0
    }
    // Word-boundary / start-of-string hits read as "real" prefixes.
    const prevCh = ti > 0 ? t[ti - 1] : ' '
    if (ti === 0) bonus += 8
    else if (BOUNDARY.test(prevCh)) bonus += 5
    score += bonus
    prevIdx = ti
    qi += 1
  }

  if (qi < q.length) return -1
  // Nudge tighter (shorter) candidates above sprawling prose that merely
  // happens to contain the letters.
  return score - t.length * 0.03
}

// Score a record that exposes a short `title` and a longer `hay` (title +
// description keywords, lowercased at build time). Two different matchers, on
// purpose:
//   • title → fuzzy subsequence, so partial / interleaved typing still finds it
//     ("kapi" → kube-apiserver), and a title hit always outranks a body hit.
//   • description/keywords → a real *contiguous substring* (indexOf), not an
//     arbitrary subsequence. Scattered subsequence matching turns long prose
//     into noise (every description "contains" the letters of "apiserver"
//     somewhere); requiring a substring keeps body hits meaningful.
// Returns -1 when neither matches.
export function scoreRecord(query, title, hay) {
  if (!query) return 0
  const q = query.toLowerCase()
  let best = -1

  const titleScore = fuzzyScore(q, title)
  if (titleScore >= 0) best = titleScore + 20

  const idx = hay.indexOf(q)
  if (idx >= 0) {
    const atBoundary = idx === 0 || BOUNDARY.test(hay[idx - 1])
    // Earlier, word-boundary occurrences rank higher; capped well below a title
    // hit so names always lead.
    const bodyScore = 11 + (atBoundary ? 6 : 0) - idx * 0.02
    best = Math.max(best, bodyScore)
  }
  return best
}
