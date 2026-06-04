import { useEffect, useRef } from 'react'

// The reconciliation-loop walkthrough navigator for the systemd Deep Dive.
// Bottom-docked and fixed to the viewport — exactly like the Overview's
// HopInspector / the deep-dive trace inspector — so the canvas behind it stays
// visible while you step the loop. It is armed from the "Scenario" dropdown (or
// by clicking a PID in the cgroup box); this panel only appears once a scenario
// is running. Each step is narrated in plain English, shown in a clickable
// timeline, and lights up the matching edge + boxes on the canvas.
//
// Mounted at App root (next to the hop inspectors) so its `position: fixed`
// anchors to the viewport rather than a transformed swipe pane.
export default function ReconControls({ loop }) {
  const { armed, scenarioName, steps, index, step, playing, canPrev, canNext, atEnd } = loop
  const panelRef = useRef(null)

  // Esc resets (disarms), ← / → walk between steps.
  useEffect(() => {
    if (!armed) return
    const onKey = (e) => {
      if (e.key === 'Escape') loop.reset()
      else if (e.key === 'ArrowRight') loop.next()
      else if (e.key === 'ArrowLeft') loop.prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, index])

  // Publish the panel height as --hop-inset so the canvas tail spacer reserves
  // room to scroll the bottom box clear of this fixed panel (mirrors HopInspector).
  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const root = document.documentElement
    const apply = () => {
      root.style.setProperty('--hop-inset', `${Math.round(el.offsetHeight) + 24}px`)
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.removeProperty('--hop-inset')
    }
  }, [armed, index])

  if (!armed) return null

  return (
    <div ref={panelRef} className="recon-nav animate-fade-in" data-noswipe>
      <div className="recon-nav-bar">
        <span className="recon-nav-tag">{step.tag}</span>
        <span className="recon-nav-title">{scenarioName}</span>
        <div className="recon-nav-controls">
          <span className="recon-nav-count">Step {index + 1} / {steps.length}</span>
          <button
            type="button"
            className="hop-inspector-nav"
            onClick={loop.prev}
            disabled={!canPrev}
            aria-label="Previous step"
          >‹</button>
          <button
            type="button"
            className="recon-nav-play"
            onClick={loop.togglePlay}
            aria-label={playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
          >
            {playing ? '⏸' : atEnd ? '↺' : '▶'}
          </button>
          <button
            type="button"
            className="hop-inspector-nav"
            onClick={loop.next}
            disabled={!canNext}
            aria-label="Next step"
          >›</button>
          <button
            type="button"
            className="hop-inspector-close"
            onClick={loop.reset}
            aria-label="Close walkthrough (Esc)"
          >✕</button>
        </div>
      </div>

      <p className="recon-nav-narration" aria-live="polite">{step.narration}</p>

      <ol className="recon-timeline">
        {steps.map((s, i) => (
          <li key={i}>
            <button
              type="button"
              className={`recon-timeline-step ${i === index ? 'is-current' : ''} ${i < index ? 'is-past' : ''}`}
              aria-current={i === index ? 'step' : undefined}
              onClick={() => loop.goTo(i)}
            >
              <span className="recon-timeline-num">{i + 1}</span>
              <span className="recon-timeline-label">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
