import { useEffect, useId, useRef, useState } from 'react'

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
  defaultOpen = false,   // start expanded — used for the "no selection" landing
                         // views, where the popover list IS the default view
}) {
  const [open, setOpen] = useState(defaultOpen)
  const ref = useRef(null)
  const triggerRef = useRef(null)
  const optionRefs = useRef([])
  const focusOnOpen = useRef(false)
  const [focusIndex, setFocusIndex] = useState(0)
  const listId = useId()

  const focusOption = (index) => {
    const bounded = Math.max(0, Math.min(index, options.length - 1))
    setFocusIndex(bounded)
    requestAnimationFrame(() => optionRefs.current[bounded]?.focus())
  }

  useEffect(() => {
    if (!open || !focusOnOpen.current) return
    focusOnOpen.current = false
    const selected = options.findIndex((option) => option.id === activeId)
    focusOption(selected >= 0 ? selected : 0)
  }, [open, activeId, options])

  // While open, close on Escape or on a pointer-down anywhere outside the card.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const onOutside = (e) => {
      if (ref.current && ref.current.contains(e.target)) return
      // Tab navigation must not collapse a default-open landing dropdown: under
      // the compact swipe pager every pane (and its default-open picker) mounts
      // at once, so the very tap used to reach this tab would otherwise close it.
      if (e.target.closest?.('.tab-btn')) return
      setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    // capture-phase so it still fires when inner handlers stopPropagation
    document.addEventListener('mousedown', onOutside, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onOutside, true)
    }
  }, [open])

  const closeAndFocus = () => {
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }
  const pick = (opt) => { onSelect(opt); closeAndFocus() }

  const onTriggerKeyDown = (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    focusOnOpen.current = true
    setFocusIndex(event.key === 'ArrowUp' ? options.length - 1 : 0)
    setOpen(true)
  }

  const onOptionKeyDown = (event, index) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeAndFocus()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusOption((index + 1) % options.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusOption((index - 1 + options.length) % options.length)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusOption(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      focusOption(options.length - 1)
    }
  }

  // Strip the leading glyph (× / ←) from the clear label for the icon button's
  // accessible name, since the × itself already reads as the clear glyph.
  const clearName = clear ? clear.label.replace(/^[×←]\s*/, '') : ''

  return (
    <div className="obj-select" ref={ref} style={{ '--obj-accent': accent }}>
      <div className="obj-select-control">
        <button
          ref={triggerRef}
          type="button"
          className={`obj-select-trigger ${open ? 'is-open' : ''}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={onTriggerKeyDown}
        >
          <span className="obj-select-label">{label}</span>
          {value?.icon && <span className="obj-select-icon" aria-hidden>{value.icon}</span>}
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
        <div className="obj-select-pop" id={listId} role="listbox" aria-label={label}>
          {options.map((opt, index) => (
            <button
              ref={(element) => { optionRefs.current[index] = element }}
              type="button"
              key={opt.id}
              role="option"
              aria-selected={opt.id === activeId}
              tabIndex={index === focusIndex ? 0 : -1}
              className={`obj-select-option ${opt.id === activeId ? 'is-active' : ''}`}
              style={{ '--opt-accent': opt.accent || accent }}
              onClick={() => pick(opt)}
              onKeyDown={(event) => onOptionKeyDown(event, index)}
            >
              <span className="obj-select-option-main">
                {opt.icon && <span className="obj-select-icon" aria-hidden>{opt.icon}</span>}
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
