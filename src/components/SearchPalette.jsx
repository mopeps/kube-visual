import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SEARCH_RECORDS, KIND_ORDER, KIND_LABEL } from '../data/search-index'
import { scoreRecord } from '../lib/fuzzy'
import useDialogFocus from '../hooks/useDialogFocus'

// How many results to surface at once — enough to span a few kinds, capped so
// the list stays a quick scan rather than a wall.
const MAX_RESULTS = 24

const KIND_ACCENT = {
  component: 'var(--k-cyan)',
  topic: 'var(--k-purple)',
  box: 'var(--k-amber)',
  event: 'var(--k-green)',
}

// A global "search the whole site" command palette (⌘K / Ctrl+K, or `/`). It
// fuzzy-matches the flat SEARCH_RECORDS index and, on pick, hands the chosen
// record back to App which routes to its destination. Modeled on AncestryModal:
// a React portal over <body>, Esc / click-outside to close.
export default function SearchPalette({ open, onClose, onSelect }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const dialogRef = useRef(null)

  useDialogFocus(open, dialogRef, onClose, { initialFocusRef: inputRef })

  // Reset the query each time the palette opens.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
  }, [open])

  // Score → sort → cap → group. The flat `ordered` list mirrors render order so
  // arrow-key navigation and Enter resolve to the same row the user sees.
  const { groups, ordered } = useMemo(() => {
    const q = query.trim()
    if (!q) return { groups: [], ordered: [] }
    const scored = []
    for (const rec of SEARCH_RECORDS) {
      const score = scoreRecord(q, rec.title, rec.hay)
      if (score >= 0) scored.push({ rec, score })
    }
    scored.sort((a, b) => b.score - a.score)
    const top = scored.slice(0, MAX_RESULTS)

    const byKind = new Map()
    for (const { rec } of top) {
      if (!byKind.has(rec.kind)) byKind.set(rec.kind, [])
      byKind.get(rec.kind).push(rec)
    }
    const groups = KIND_ORDER
      .filter((k) => byKind.has(k))
      .map((k) => ({ kind: k, label: KIND_LABEL[k], items: byKind.get(k) }))
    const ordered = groups.flatMap((g) => g.items)
    return { groups, ordered }
  }, [query])

  // Keep the active index in range as the result set changes under the query.
  useEffect(() => { setActive(0) }, [query])

  // Keyboard model: ↑/↓ move, Enter picks, Esc closes. Bound on the input.
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, ordered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const rec = ordered[active]
      if (rec) onSelect(rec)
    }
  }

  // Scroll the active row into view as it moves under the keyboard.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const q = query.trim()

  return createPortal(
    <div
      className="search-overlay animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div ref={dialogRef} className="search-palette" role="dialog" aria-modal="true" aria-label="Search" tabIndex={-1}>
        <div className="search-input-row">
          <span className="search-input-icon" aria-hidden>⌕</span>
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Search objects & technologies…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded={ordered.length > 0}
            aria-controls="search-results"
            aria-activedescendant={ordered[active] ? `search-opt-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <button className="search-close" onClick={onClose} aria-label="Close (Esc)">✕</button>
        </div>

        <div className="search-results" id="search-results" ref={listRef} role="listbox" aria-label="Search results">
          {!q && (
            <p className="search-hint">
              Type to fuzzy-search components, deep dives, sections, and trace flows.
              <br />
              <span className="search-hint-keys">↑↓ to navigate · ↵ to open · Esc to close</span>
            </p>
          )}
          {q && ordered.length === 0 && (
            <p className="search-hint">No matches for “{q}”.</p>
          )}
          {groups.map((group) => (
            <div key={group.kind} className="search-group">
              <div className="search-group-label">{group.label}</div>
              {group.items.map((rec) => {
                const idx = ordered.indexOf(rec)
                return (
                  <button
                    type="button"
                    key={`${rec.kind}-${rec.topicId || 'root'}-${rec.id}`}
                    id={`search-opt-${idx}`}
                    data-idx={idx}
                    role="option"
                    aria-selected={idx === active}
                    className={`search-option ${idx === active ? 'is-active' : ''}`}
                    style={{ '--opt-accent': KIND_ACCENT[rec.kind] }}
                    onMouseMove={() => setActive(idx)}
                    onClick={() => onSelect(rec)}
                  >
                    <span className="search-option-main">
                      <span className="search-option-title">{rec.title}</span>
                      {rec.subtitle && (
                        <span className="search-option-sub">{rec.subtitle}</span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
