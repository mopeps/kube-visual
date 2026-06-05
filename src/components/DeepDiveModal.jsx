import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ManifestBlock } from './Manifest'
import ExploreCommands from './ExploreCommands'
import UnitGallery from './UnitGallery'
import DeepTree from './DeepTree'

// A detail popup for a deep-dive box. Shares AncestryModal's look, gestures and
// CSS classes (.ancestry-overlay / .ancestry-modal / grip-resize / swipe-dismiss
// / Esc-close / peek mode) but renders generic content — a description plus
// sections of prose, key/value rows, copyable commands, an example unit, or an
// ASCII blueprint — instead of a registered component.
//
//   content = { title, typePrefix?, accent, detail: { role?, summary, sections } }

const DRAG_DISMISS_PX = 130
const DRAG_SLOP_PX = 8
const MIN_SHEET_PX = 220
const DISMISS_SHEET_PX = 120
let lastSheetHeight = null

export default function DeepDiveModal({ content, onClose }) {
  const [offset, setOffset] = useState(0)
  const [snapping, setSnapping] = useState(false)
  const [sheetHeight, setSheetHeight] = useState(lastSheetHeight)
  const [resizing, setResizing] = useState(false)
  const modalRef = useRef(null)
  const bodyRef = useRef(null)
  const drag = useRef({ startY: 0, atTop: false, mode: 'scroll' })
  const resize = useRef({ active: false, bottom: 0 })

  const peek = sheetHeight != null
  const key = content?.id

  useEffect(() => {
    if (!key) return
    setOffset(0)
    setSnapping(false)
    drag.current = { startY: 0, atTop: false, mode: 'scroll' }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [key, onClose])

  // Lock the page behind the modal (skipped in peek mode). Mirrors AncestryModal.
  useEffect(() => {
    if (!key || peek) return
    const scrollY = window.scrollY
    const body = document.body
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    }
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    return () => {
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.width = prev.width
      body.style.overflow = prev.overflow
      window.scrollTo(0, scrollY)
    }
  }, [key, peek])

  useEffect(() => {
    if (!key || !peek) return
    const root = document.documentElement
    return () => root.style.removeProperty('--peek-inset')
  }, [key, peek])
  useEffect(() => {
    if (!key || !peek || resizing) return
    document.documentElement.style.setProperty('--peek-inset', `${Math.round(sheetHeight) + 24}px`)
  }, [key, peek, resizing, sheetHeight])

  // ── Grip resize ──────────────────────────────────────────────────────
  const onGripPointerDown = (e) => {
    if (!modalRef.current) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    resize.current = { active: true, bottom: window.innerHeight }
    setResizing(true)
    setOffset(0)
  }
  const onGripPointerMove = (e) => {
    if (!resize.current.active) return
    const max = window.innerHeight
    const next = Math.max(0, Math.min(resize.current.bottom - e.clientY, max))
    setSheetHeight(next)
  }
  const settleResize = (dismissable) => {
    if (!resize.current.active) return
    resize.current.active = false
    setResizing(false)
    setSheetHeight((h) => {
      if (dismissable && h != null && h < DISMISS_SHEET_PX) { onClose(); return h }
      const settled = h == null ? null : Math.max(h, MIN_SHEET_PX)
      lastSheetHeight = settled
      return settled
    })
  }
  const onGripPointerUp = () => settleResize(true)
  const onGripPointerCancel = () => settleResize(false)
  const onGripDoubleClick = () => { lastSheetHeight = null; setSheetHeight(null) }

  // ── Body swipe-to-dismiss (touch) ──────────────────────────────────────
  const onTouchStart = (e) => {
    const atTop = !bodyRef.current || bodyRef.current.scrollTop <= 0
    drag.current = { startY: e.touches[0].clientY, atTop, mode: null }
    setSnapping(false)
  }
  const onTouchMove = (e) => {
    const st = drag.current
    if (!st.atTop) return
    const dy = e.touches[0].clientY - st.startY
    if (st.mode === null) {
      if (Math.abs(dy) < DRAG_SLOP_PX) return
      st.mode = dy > 0 ? 'drag' : 'scroll'
      if (st.mode === 'scroll') return
    }
    if (st.mode !== 'drag') return
    if (bodyRef.current && bodyRef.current.scrollTop > 0) {
      st.mode = 'scroll'
      setOffset(0)
      return
    }
    setOffset(dy > 0 ? dy : 0)
  }
  const onTouchEnd = () => {
    const wasDrag = drag.current.mode === 'drag'
    const dragged = offset
    drag.current.mode = 'scroll'
    if (!wasDrag) return
    setSnapping(true)
    if (dragged >= DRAG_DISMISS_PX) onClose()
    else setOffset(0)
  }

  if (!content) return null

  const { title, typePrefix, subtitle, accent = 'var(--k-cyan)', detail } = content
  const transition = resizing
    ? 'none'
    : snapping
      ? 'transform 0.3s ease'
      : 'height 0.18s ease'

  return createPortal(
    <div
      className={`ancestry-overlay dd-overlay animate-fade-in${peek ? ' is-peek' : ''}${resizing ? ' is-resizing' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={modalRef}
        className="ancestry-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          height: sheetHeight != null ? `${sheetHeight}px` : undefined,
          transform: offset > 0 ? `translateY(${offset}px)` : undefined,
          transition,
        }}
      >
        <div
          className="ancestry-grip"
          role="separator"
          aria-label="Drag to resize · double-click to reset"
          onPointerDown={onGripPointerDown}
          onPointerMove={onGripPointerMove}
          onPointerUp={onGripPointerUp}
          onPointerCancel={onGripPointerCancel}
          onDoubleClick={onGripDoubleClick}
        >
          <span className="ancestry-grip-bar" />
        </div>
        <button className="detail-close" onClick={onClose} aria-label="Close (Esc)">✕</button>

        <div
          ref={bodyRef}
          className="ancestry-modal-body"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          <div className="detail-title" style={{ color: accent }}>
            {typePrefix && <span className="detail-type-prefix">[{typePrefix}]&nbsp;</span>}
            {title}
          </div>

          {subtitle && <div className="deep-detail-subtitle">{subtitle}</div>}

          {detail?.summary && (
            <div className="detail-section">
              <div className="why-callout" style={{ borderColor: `${accent}59`, background: `${accent}12` }}>
                <div className="why-body">
                  {detail.role && (
                    <span className="why-role" style={{ color: accent, borderColor: `${accent}66`, background: `${accent}1a` }}>
                      {detail.role}
                    </span>
                  )}
                  <p className="why-text">{detail.summary}</p>
                </div>
              </div>
            </div>
          )}

          {detail?.sections?.map((sec, i) => (
            <div key={i} className="detail-section">
              {sec.heading && <h4>{sec.heading}</h4>}
              {sec.body && <p>{sec.body}</p>}

              {/* Keyword chips — short, self-explanatory concepts at a glance. */}
              {sec.tags?.length > 0 && (
                <div className="deep-tags">
                  {sec.tags.map((t) => (
                    <span key={t} className="deep-tag" style={{ '--tag-accent': accent }}>{t}</span>
                  ))}
                </div>
              )}

              {/* States — colour-coded status pills (green=ok, red=failed,
                  amber=transitional, dim=idle) each with a one-line meaning, so
                  the state set is legible by colour at a glance. */}
              {sec.states?.length > 0 && (
                <div className="deep-states">
                  {sec.states.map((s) => (
                    <div key={s.label} className={`deep-state deep-state--${s.tone || 'idle'}`}>
                      <span className="deep-state-pill"><span className="deep-state-dot" />{s.label}</span>
                      <span className="deep-state-meaning">{s.meaning}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Facts — a labelled accent chip + one short value. Flatter and
                  more scannable than a prose key/value list. */}
              {sec.facts?.length > 0 && (
                <div className="deep-facts">
                  {sec.facts.map((row, j) => (
                    <div key={j} className="deep-fact">
                      <span className="deep-fact-key" style={{ color: accent, borderColor: `${accent}66`, background: `${accent}1a` }}>
                        {row.k}
                      </span>
                      <span className="deep-fact-val">{row.v}</span>
                    </div>
                  ))}
                </div>
              )}

              {sec.bullets?.length > 0 && (
                <ul className="deep-bullets" style={{ '--tag-accent': accent }}>
                  {sec.bullets.map((b, j) => <li key={j}>{b}</li>)}
                </ul>
              )}
              {sec.kv?.length > 0 && (
                <dl className="detail-kv">
                  {sec.kv.map((row, j) => (
                    <div key={j} className="detail-kv-row">
                      <dt style={{ color: accent }}>{row.k}</dt>
                      <dd>{row.v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {sec.units?.length > 0 && (
                <UnitGallery units={sec.units} color={accent} />
              )}
              {sec.tree && <DeepTree tree={sec.tree} accent={accent} />}
              {sec.manifest && (
                <ManifestBlock body={sec.manifest.body} kind={sec.manifest.kind} color={accent} />
              )}
              {sec.commands?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <ExploreCommands commands={sec.commands} color={accent} />
                </div>
              )}
              {sec.ascii && <pre className="code-block deep-ascii">{sec.ascii}</pre>}
            </div>
          ))}

          <div
            className="text-[0.6rem] mt-6 pt-4 border-t"
            style={{ color: 'var(--tx-dim)', borderColor: 'var(--border-d)' }}
          >
            Press <span style={{ color: 'var(--tx-muted)' }}>Esc</span> or tap outside to close
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
