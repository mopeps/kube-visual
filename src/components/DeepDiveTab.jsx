import { useState, useEffect, useMemo, useCallback } from 'react'
import { DEEP_DIVES, findDeepDive, indexTopicBoxes } from '../data/deep-dives'
import DeepDiveCanvas from './DeepDiveCanvas'
import DeepDiveModal from './DeepDiveModal'

const accent = (colorVar) => `var(--${colorVar || 'k-cyan'})`

// Default view: an index of every in-depth page so the tab is never empty.
function TopicIndex({ onSelectTopic }) {
  return (
    <div>
      <div className="mb-3">
        <div className="font-display text-[1.1rem] font-semibold mb-0.5">Deep dives</div>
        <p className="text-[0.72rem]" style={{ color: 'var(--tx-muted)' }}>
          Ground-up explainers one level below the topology — laid out like the
          overview: labelled zones of clickable boxes, each opening a detail popup.
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
              {countBoxes(t)} boxes →
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Always-available switcher: jump to any other deep dive, or clear to the index.
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
  const [selectedBoxId, setSelectedBoxId] = useState(null)

  const topic = activeTopic ? findDeepDive(activeTopic) : null
  const boxIndex = useMemo(() => (topic ? indexTopicBoxes(topic) : {}), [topic])

  // Switching topics drops any open popup.
  useEffect(() => { setSelectedBoxId(null) }, [activeTopic])

  const selectBox = useCallback((id) => setSelectedBoxId(id), [])
  const closeBox = useCallback(() => setSelectedBoxId(null), [])

  if (!topic) {
    return <TopicIndex onSelectTopic={onSelectTopic} />
  }

  const selected = selectedBoxId ? boxIndex[selectedBoxId] : null
  const content = selected
    ? {
        id: selected.box.id,
        title: selected.box.title,
        typePrefix: selected.box.typePrefix,
        accent: selected.accent,
        detail: selected.box.detail,
      }
    : null

  return (
    <div className="deep-dive">
      <TopicSwitcher
        activeTopic={activeTopic}
        onSelectTopic={onSelectTopic}
        onClearTopic={onClearTopic}
      />
      <div className="mb-4">
        <div className="font-display text-[1.05rem] font-semibold leading-tight" style={{ color: accent(topic.colorVar) }}>
          {topic.title}
        </div>
        <p className="text-[0.74rem] mt-1 leading-snug" style={{ color: 'var(--tx-muted)' }}>
          {topic.tagline}
        </p>
      </div>

      <DeepDiveCanvas topic={topic} onSelectBox={selectBox} />

      <DeepDiveModal content={content} onClose={closeBox} />
    </div>
  )
}

function countBoxes(topic) {
  let n = 0
  const walk = (zones) => {
    for (const z of zones) {
      n += z.boxes?.length || 0
      if (z.zones) walk(z.zones)
    }
  }
  walk(topic.zones || [])
  return n
}
