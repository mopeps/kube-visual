// Tiny hand-rolled fuzzy matcher — no dependency, in keeping with the repo's
// hand-rolled ethos (cf. ArrowLines). It scores how well a query subsequence
// fits a candidate string; the search palette ranks records by this score.
//
// `fuzzyMatch` returns the score AND the matched character positions (so the
// palette can highlight them); `fuzzyScore` is the score-only shorthand. The
// score rewards contiguous runs and matches at word boundaries, so "kapi"
// surfaces "kube-apiserver" and "cgrp" surfaces "cgroup" ahead of incidental
// hits.

const BOUNDARY = /[\s\-_/.:()[\]]/

// Score tiers, widely separated so a hit in a higher tier always outranks any
// hit in a lower one (a name beats a description beats deep prose):
//   • title  — fuzzy subsequence over the display name.
//   • body   — contiguous substring in the curated name+one-liner haystack.
//   • deep   — contiguous substring in the long prose (interactions, commands,
//              step text). Capped low, on purpose: deep matches are the
//              "search everything" safety net, never the headline result.
const TITLE_BONUS = 20
const BODY_BASE = 11
const BODY_BOUNDARY = 6
const DEEP_BASE = 6
const DEEP_BOUNDARY = 2

// Subsequence matcher → { score, positions } when every query char appears in
// order inside text, or null when it doesn't.
export function fuzzyMatch(query, text) {
  if (!query) return { score: 0, positions: [] }
  if (!text) return null
  const q = query.toLowerCase()
  const t = text.toLowerCase()

  let qi = 0
  let score = 0
  let run = 0
  let prevIdx = -2
  const positions = []

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
    positions.push(ti)
    prevIdx = ti
    qi += 1
  }

  if (qi < q.length) return null
  // Nudge tighter (shorter) candidates above sprawling prose that merely
  // happens to contain the letters.
  return { score: score - t.length * 0.03, positions }
}

export function fuzzyScore(query, text) {
  const m = fuzzyMatch(query, text)
  return m ? m.score : -1
}

// Build a short, original-cased context window around a substring hit at `idx`,
// with the highlight offset expressed *within* the snippet. Used to show WHY a
// deep-prose result matched, so it doesn't read as a random hit.
function makeSnippet(text, idx, len, radius = 34) {
  let start = Math.max(0, idx - radius)
  const end = Math.min(text.length, idx + len + radius)
  // Don't slice mid-word at the left edge — walk forward to the next space.
  if (start > 0) {
    const sp = text.indexOf(' ', start)
    if (sp >= 0 && sp < idx) start = sp + 1
  }
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return {
    text: prefix + text.slice(start, end) + suffix,
    hlStart: prefix.length + (idx - start),
    hlLen: len,
  }
}

// Score a search record against a query across the three tiers and return the
// single best match as a descriptor the palette can both rank and render:
//   { score, tier, positions?, snippet? }
// `positions` accompanies a title (subsequence) match so its chars can be
// highlighted; `snippet` accompanies a deep match. Returns null when nothing
// matches. The record exposes:
//   title   — display name (subsequence-matched)
//   hay     — lowercased name + one-line description keywords (substring)
//   deep    — original-cased long prose (substring; optional)
//   deepLc  — lowercased copy of `deep` for matching (optional)
export function scoreRecord(query, rec) {
  if (!query) return null
  const q = query.toLowerCase()
  let best = null

  // 1) Title — fuzzy subsequence, so partial / interleaved typing still finds
  //    it ("kapi" → kube-apiserver). Always outranks a body or deep hit.
  const tm = fuzzyMatch(q, rec.title)
  if (tm) best = { score: tm.score + TITLE_BONUS, tier: 'title', positions: tm.positions }

  // 2) Description keywords — a real contiguous substring (indexOf), not an
  //    arbitrary subsequence: scattered subsequence matching turns long prose
  //    into noise. Earlier, word-boundary occurrences rank higher.
  if (rec.hay) {
    const idx = rec.hay.indexOf(q)
    if (idx >= 0) {
      const atBoundary = idx === 0 || BOUNDARY.test(rec.hay[idx - 1])
      const score = BODY_BASE + (atBoundary ? BODY_BOUNDARY : 0) - idx * 0.02
      if (!best || score > best.score) best = { score, tier: 'body' }
    }
  }

  // 3) Deep prose — the lower-priority "search everything" tier. Only adopted
  //    when nothing in a higher tier matched (a title/body hit always wins), so
  //    deep matches sink below the high-signal results instead of displacing
  //    them. Carries a snippet so the row can show where it matched.
  if (rec.deepLc && (!best || best.tier === 'deep')) {
    const idx = rec.deepLc.indexOf(q)
    if (idx >= 0) {
      const atBoundary = idx === 0 || BOUNDARY.test(rec.deepLc[idx - 1])
      const score = DEEP_BASE + (atBoundary ? DEEP_BOUNDARY : 0) - idx * 0.005
      if (!best || score > best.score) {
        best = { score, tier: 'deep', snippet: makeSnippet(rec.deep, idx, q.length) }
      }
    }
  }

  return best
}
