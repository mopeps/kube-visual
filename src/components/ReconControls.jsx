import { useEffect } from 'react'
import { useDockPanel } from '../hooks/useDockPanel'

// The reconciliation-loop walkthrough navigator for the systemd Deep Dive.
// Bottom-docked and fixed to the viewport — exactly like the Overview's
// HopInspector / the deep-dive trace inspector — so the canvas behind it stays
// visible while you step the loop. It shares the grip-resizable panel behaviour
// (defaults to a third of the viewport) via useDockPanel. It is armed from the
// "Scenario" dropdown (or by clicking a PID in the cgroup box); this panel only
// appears once a scenario is running. Each step is narrated, shown in a clickable
// timeline, and lights up the matching edge + boxes on the canvas.
//
// Mounted at App root (next to the hop inspectors) so its `position: fixed`
// anchors to the viewport rather than a transformed swipe pane.
export default function ReconControls({ loop }) {
  const { armed, scenarioName, steps, index, step, playing, canPrev, canNext, atEnd } = loop
  const { panelRef, height, resizing, gripProps } = useDockPanel([index])

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

  if (!armed) return null

  return (
    <div
      ref={panelRef}
      className={`recon-nav animate-fade-in${resizing ? ' is-resizing' : ''}`}
      data-noswipe
      style={{ height: height != null ? `${height}px` : undefined }}
    >
      <div
        className="hop-inspector-grip"
        role="separator"
        aria-label="Drag to resize · double-click to reset"
        {...gripProps}
      >
        <span className="hop-inspector-grip-bar" />
      </div>
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

      {loop.lede && <p className="recon-nav-lede">{loop.lede}</p>}

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
