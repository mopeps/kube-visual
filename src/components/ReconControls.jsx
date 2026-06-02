// The reconciliation-loop walkthrough UI for the Deep Dive canvas. Replaces the
// old "kill it and watch the phases race by" control bar with a manual,
// step-through experience: the user arms a scenario (kill the main PID, or click
// a child PID in the cgroup box), then walks Prev/Next — or hits Play — through
// the ordered events. Each step is narrated in plain English, shown in a
// clickable timeline, and lights up the matching edge + boxes on the canvas.

export default function ReconControls({ loop, recon }) {
  const { armed, scenario, steps, index, step, playing, canPrev, canNext, atEnd } = loop

  return (
    <div className="recon-walk" data-noswipe>
      <div className="recon-walk-bar">
        <span className="recon-walk-title">Reconciliation loop</span>

        {!armed ? (
          <div className="recon-walk-arm">
            <span className="recon-walk-hint">Trace it one event at a time —</span>
            <button type="button" className="recon-btn recon-btn--kill" onClick={loop.killMain}>
              ⚡ Kill main PID {recon.main.pid}
            </button>
            <span className="recon-walk-hint">or click a child PID in the cgroup box.</span>
          </div>
        ) : (
          <>
            <span className="recon-walk-scenario">
              {scenario === 'main' ? 'Main-PID kill → restart' : 'Child-PID kill → reap'}
            </span>
            <div className="recon-steps-ctrl" role="group" aria-label="Step controls">
              <button type="button" className="recon-btn" onClick={loop.prev} disabled={!canPrev} aria-label="Previous step">
                ‹ Prev
              </button>
              <button type="button" className="recon-btn recon-btn--play" onClick={loop.togglePlay}>
                {playing ? '⏸ Pause' : atEnd ? '↺ Replay' : '▶ Play'}
              </button>
              <button type="button" className="recon-btn" onClick={loop.next} disabled={!canNext} aria-label="Next step">
                Next ›
              </button>
            </div>
            <span className="recon-walk-count">Step {index + 1} / {steps.length}</span>
            <button type="button" className="recon-btn recon-walk-reset" onClick={loop.reset}>
              × Reset
            </button>
          </>
        )}
      </div>

      {armed && (
        <div className="recon-walk-body">
          <p className="recon-narration" aria-live="polite">
            <span className="recon-narration-tag" style={{ color: 'var(--k-amber)' }}>{step.tag}</span>
            {step.narration}
          </p>

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
      )}
    </div>
  )
}
