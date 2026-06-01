import { useState, useEffect } from 'react'
import { DEEP_DIVES, findDeepDive } from '../data/deep-dives'
import { ManifestBlock } from './Manifest'
import ExploreCommands from './ExploreCommands'

const accent = (colorVar) => `var(--${colorVar || 'k-cyan'})`

// One numbered stage row — reuses the packet-flow `.hop` styling (numbered
// circle + connector + body card) so a boot sequence reads exactly like a trace.
// Click toggles the deeper body (prose, bullets, an example unit file, commands).
function Stage({ step, n, isOpen, onToggle, isFinal, topicColor }) {
  const color = accent(step.colorVar) || topicColor
  const hasDetail = !!(step.body || step.bullets?.length || step.manifest || step.commands?.length)

  return (
    <div className="hop" onClick={hasDetail ? onToggle : undefined} style={{ cursor: hasDetail ? 'pointer' : 'default' }}>
      <div className="hop-num-col">
        <div
          className="hop-num"
          style={{ background: `${color}26`, border: `1px solid ${color}`, color }}
        >
          {n}
        </div>
        {!isFinal && (
          <div className="hop-line" style={{ background: `linear-gradient(${color}, ${color}33)` }} />
        )}
      </div>
      <div className="hop-body" style={{ borderColor: isOpen ? color : `${color}40` }}>
        {step.kicker && (
          <div className="deep-kicker" style={{ color }}>{step.kicker}</div>
        )}
        <h3 style={{ color: 'var(--tx-bright)' }}>{step.label}</h3>

        {hasDetail && (
          <>
            <div className={`hop-detail ${isOpen ? 'is-open' : ''}`}>
              {step.body && <p className="deep-body">{step.body}</p>}
              {step.bullets?.length > 0 && (
                <ul className="deep-bullets">
                  {step.bullets.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              )}
              {step.manifest && (
                <div style={{ marginTop: 10 }}>
                  <ManifestBlock body={step.manifest.body} kind={step.manifest.kind} color={color} />
                </div>
              )}
              {step.commands?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <ExploreCommands commands={step.commands} color={color} />
                </div>
              )}
            </div>
            <span className={`hop-chevron ${isOpen ? 'is-open' : ''}`} aria-hidden>⌄</span>
          </>
        )}
      </div>
    </div>
  )
}

// Default view: an index of every in-depth page so the tab is never empty.
// Picking one opens it. Mirrors the packet-flow EventGallery.
function TopicIndex({ onSelectTopic }) {
  return (
    <div>
      <div className="mb-3">
        <div className="font-display text-[1.1rem] font-semibold mb-0.5">Deep dives</div>
        <p className="text-[0.72rem]" style={{ color: 'var(--tx-muted)' }}>
          Ground-up explainers one level below the topology — systemd and the boot
          chain that the cluster’s host services actually run in.
        </p>
      </div>
      <div className="event-gallery">
        {DEEP_DIVES.map((t) => (
          <button
            key={t.topicId}
            type="button"
            className="event-card deep-card"
            style={{ '--deep-accent': accent(t.colorVar) }}
            onClick={() => onSelectTopic(t.topicId)}
          >
            <div className="event-card-title">{t.title}</div>
            <p className="event-card-desc">{t.tagline}</p>
            <div className="event-card-meta" style={{ color: accent(t.colorVar) }}>
              {t.steps.length} stage{t.steps.length === 1 ? '' : 's'} →
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Always-available switcher: jump to any other deep dive, or clear back to the
// index. Mirrors the packet-flow FlowSwitcher.
function TopicSwitcher({ activeTopic, onSelectTopic, onClearTopic }) {
  return (
    <div className="flow-switcher">
      <span className="flow-switcher-label">Deep dive</span>
      {DEEP_DIVES.map((t) => (
        <button
          key={t.topicId}
          type="button"
          className={`event-pill ${activeTopic === t.topicId ? 'is-active' : ''}`}
          style={activeTopic === t.topicId ? { '--deep-accent': accent(t.colorVar) } : undefined}
          onClick={() => onSelectTopic(t.topicId)}
          title={t.title}
        >
          {t.title}
        </button>
      ))}
      {onClearTopic && (
        <button type="button" className="event-pill flow-switcher-clear" onClick={onClearTopic}>
          × Clear
        </button>
      )}
    </div>
  )
}

export default function DeepDiveTab({ activeTopic, onSelectTopic, onClearTopic }) {
  const [open, setOpen] = useState(() => new Set())

  // Each topic's stages are keyed by index, so a row left open on one topic
  // would otherwise appear pre-expanded on the next. Reset on topic change.
  useEffect(() => { setOpen(new Set()) }, [activeTopic])

  const topic = activeTopic ? findDeepDive(activeTopic) : null

  if (!topic) {
    return <TopicIndex onSelectTopic={onSelectTopic} />
  }

  const topicColor = accent(topic.colorVar)
  const toggle = (i) => {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <div className="deep-dive">
      <TopicSwitcher
        activeTopic={activeTopic}
        onSelectTopic={onSelectTopic}
        onClearTopic={onClearTopic}
      />
      <div className="mb-3">
        <div className="font-display text-[1.05rem] font-semibold leading-tight" style={{ color: topicColor }}>
          {topic.title}
        </div>
        <p className="text-[0.74rem] mt-1 leading-snug" style={{ color: 'var(--tx-muted)' }}>
          {topic.tagline}
        </p>
      </div>
      <div>
        {topic.steps.map((step, i) => (
          <Stage
            key={i}
            step={step}
            n={i + 1}
            isOpen={open.has(i)}
            onToggle={() => toggle(i)}
            isFinal={i === topic.steps.length - 1}
            topicColor={topicColor}
          />
        ))}
      </div>
    </div>
  )
}
