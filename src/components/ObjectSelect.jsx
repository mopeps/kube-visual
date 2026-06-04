import { useEffect, useRef, useState } from 'react'

// A compact picker styled in the app's "open an object" idiom (cf. the etcd
// IntentStoreCard): a clickable trigger card that opens a FLOATING popover list
// of choices. Picking one fires onSelect and closes; click-outside / Esc close.
//
// Kept generic so every trace picker can share it — the Overview's event flow
// and the Deep Dive's topic + flow. The popover is absolutely positioned inside
// the relative trigger wrapper (no portal): the swipe track is transformed —
// which would break position:fixed — and each pane is its own scroll container,
// so an anchored absolute popover floats over the canvas and scrolls naturally
// with the content instead of pushing it down.
//
// options: [{ id, title, meta?, accent?, ...payload }]
// Kept deliberately lean — title + a short meta chip only, no description blurb —
// so the popover stays a quick, scannable picker rather than a wall of prose.
// onSelect receives the full option object, so call sites can stash whatever
// payload they need to act on (e.g. the raw event / flow) on each option.
export default function ObjectSelect({
  label,
  accent = 'var(--k-cyan)',
  value,                 // { title, meta? } | null  (the current selection)
  placeholder = 'Choose…',
  options,
  activeId,              // id of the current selection (drives the ✓)
  onSelect,
  clear,                 // optional { label, onClear } row at the foot of the list
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // While open, close on Escape or on a pointer-down anywhere outside the card.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const onOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    window.addEventListener('keydown', onKey)
    // capture-phase so it still fires when inner handlers stopPropagation
    document.addEventListener('mousedown', onOutside, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onOutside, true)
    }
  }, [open])

  const pick = (opt) => { onSelect(opt); setOpen(false) }

  // Strip the leading glyph (× / ←) from the clear label for the icon button's
  // accessible name, since the × itself already reads as the clear glyph.
  const clearName = clear ? clear.label.replace(/^[×←]\s*/, '') : ''

  return (
    <div className="obj-select" ref={ref} style={{ '--obj-accent': accent }}>
      <div className="obj-select-control">
        <button
          type="button"
          className={`obj-select-trigger ${open ? 'is-open' : ''}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="obj-select-label">{label}</span>
          <span className="obj-select-value">
            {value ? (
              <>
                <span className="obj-select-title" style={{ color: accent }}>{value.title}</span>
                {value.meta && <span className="obj-select-meta">{value.meta}</span>}
              </>
            ) : (
              <span className="obj-select-placeholder">{placeholder}</span>
            )}
          </span>
          <span className="obj-select-chevron" aria-hidden>▾</span>
        </button>
        {/* One-click clear, always visible beside the trigger when there's an
            active selection — so clearing a flow/event no longer means opening
            the dropdown to hunt for the clear row at the foot of the list. */}
        {clear && value && (
          <button
            type="button"
            className="obj-select-clearbtn"
            onClick={() => clear.onClear()}
            aria-label={clearName || 'Clear selection'}
            title={clear.label}
          >×</button>
        )}
      </div>

      {open && (
        <div className="obj-select-pop" role="listbox">
          {options.map((opt) => (
            <button
              type="button"
              key={opt.id}
              role="option"
              aria-selected={opt.id === activeId}
              className={`obj-select-option ${opt.id === activeId ? 'is-active' : ''}`}
              style={{ '--opt-accent': opt.accent || accent }}
              onClick={() => pick(opt)}
            >
              <span className="obj-select-option-main">
                <span className="obj-select-option-title">{opt.title}</span>
                {opt.meta && <span className="obj-select-option-meta">{opt.meta}</span>}
              </span>
              {opt.id === activeId && <span className="obj-select-check" aria-hidden>✓</span>}
            </button>
          ))}
          {clear && (
            <button
              type="button"
              className="obj-select-option obj-select-clear"
              onClick={() => { clear.onClear(); setOpen(false) }}
            >
              <span className="obj-select-option-main">
                <span className="obj-select-option-title">{clear.label}</span>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
