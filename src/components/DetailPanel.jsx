import { useEffect, useState } from 'react'
import componentsData from '../data/components.json'
import { COMPONENT_COLOR, COMPONENT_ZONE, COMPONENT_BADGES } from '../data/zones'
import { BADGE_GLOSSARY } from '../data/badge-glossary'
import { PRIMITIVES_BY_TYPE, SELF_PRIMITIVE_IDS } from '../data/primitives'

function ExploreCommands({ commands, color }) {
  const [copiedIndex, setCopiedIndex] = useState(null)
  const copy = (text, i) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(i)
      setTimeout(() => setCopiedIndex(null), 1800)
    })
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {commands.map((cmd, i) => (
        <div
          key={i}
          style={{
            border: '1px solid var(--border-w)',
            borderRadius: 6,
            background: 'rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-1.5"
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderBottom: '1px solid var(--border-d)',
            }}
          >
            <span
              className="text-[0.6rem] uppercase tracking-[0.14em]"
              style={{ color: 'var(--tx-muted)' }}
            >
              shell · {String(i + 1).padStart(2, '0')}
            </span>
            <button
              onClick={() => copy(cmd, i)}
              className="text-[0.62rem] px-2 py-0.5 rounded border transition-colors"
              style={{
                color: copiedIndex === i ? 'var(--bg)' : 'var(--tx-muted)',
                background: copiedIndex === i ? color : 'transparent',
                borderColor: copiedIndex === i ? color : 'var(--border-w)',
              }}
            >
              {copiedIndex === i ? '✓ copied' : 'copy'}
            </button>
          </div>
          <pre className="code-block" style={{ border: 'none', borderRadius: 0 }}>
            {cmd}
          </pre>
        </div>
      ))}
    </div>
  )
}

function PrimitiveInline({ primitive, color }) {
  return (
    <div
      style={{
        marginTop: 8,
        padding: '10px 12px',
        borderRadius: 6,
        border: `1px solid ${color}40`,
        background: `${color}0d`,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '0.72rem', color, marginBottom: 4 }}>
        {primitive.label}
      </div>
      <p style={{ fontSize: '0.72rem', color: 'var(--tx)', margin: '0 0 8px' }}>
        {primitive.description}
      </p>
      {primitive.interactions?.length > 0 && (
        <ul style={{ margin: '0 0 8px', paddingLeft: 16 }}>
          {primitive.interactions.map((line, i) => (
            <li key={i} style={{ fontSize: '0.7rem', color: 'var(--tx-muted)', marginBottom: 2 }}>
              {line}
            </li>
          ))}
        </ul>
      )}
      {primitive.commands?.length > 0 && (
        <ExploreCommands commands={primitive.commands} color={color} />
      )}
    </div>
  )
}

export default function DetailPanel({ componentId, onClose, onSelectComponent }) {
  const [copiedIndex, setCopiedIndex] = useState(null)
  const [expandedPrimitive, setExpandedPrimitive] = useState(null)
  const [expandedBadge, setExpandedBadge] = useState(null)

  useEffect(() => {
    if (!componentId) return
    setExpandedPrimitive(null)
    setExpandedBadge(null)
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [componentId, onClose])

  if (!componentId) return <aside className="detail-panel" aria-hidden="true" />

  const component = componentsData.find(c => c.componentId === componentId)
  if (!component) return <aside className="detail-panel" aria-hidden="true" />

  const color = COMPONENT_COLOR[componentId] || 'var(--k-cyan)'
  const zone = COMPONENT_ZONE[componentId]
  const primitiveSet = SELF_PRIMITIVE_IDS.has(componentId) || component.layer === 'External'
    ? null
    : PRIMITIVES_BY_TYPE[component.typePrefix] || null

  const copy = (text, i) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(i)
      setTimeout(() => setCopiedIndex(null), 1800)
    })
  }

  return (
    <aside className="detail-panel is-open" role="dialog" aria-label={component.displayName}>
      <div className="detail-drag-handle" />
      <button className="detail-close" onClick={onClose} aria-label="Close (Esc)">
        ✕
      </button>

      <div className="detail-title" style={{ color }}>
        {component.typePrefix && (
          <span className="detail-type-prefix">[{component.typePrefix}]&nbsp;</span>
        )}
        {component.displayName}
      </div>
      <div className="detail-type" style={{ color }}>
        {zone?.label || component.layer}
      </div>

      {(() => {
        const badges = COMPONENT_BADGES[componentId] || []
        if (!badges.length) return null
        const explanation = expandedBadge ? BADGE_GLOSSARY[expandedBadge] : null
        return (
          <div className="detail-section">
            <h4>Tags</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: explanation ? 12 : 0 }}>
              {badges.map((b) => {
                const isOpen = expandedBadge === b.label
                const hasExplanation = !!BADGE_GLOSSARY[b.label]
                return (
                  <button
                    key={b.label}
                    onClick={() => setExpandedBadge(isOpen ? null : b.label)}
                    className="node-badge"
                    style={{
                      color: isOpen ? 'var(--bg)' : b.color,
                      borderColor: isOpen ? b.color : `${b.color}66`,
                      background: isOpen ? b.color : `${b.color}1a`,
                      fontSize: '0.62rem',
                      padding: '4px 10px',
                      cursor: hasExplanation ? 'pointer' : 'default',
                      fontFamily: 'inherit',
                      transition: 'background 0.15s, color 0.15s',
                      opacity: hasExplanation ? 1 : 0.6,
                    }}
                    onMouseEnter={e => {
                      if (hasExplanation && !isOpen) e.currentTarget.style.background = `${b.color}35`
                    }}
                    onMouseLeave={e => {
                      if (!isOpen) e.currentTarget.style.background = `${b.color}1a`
                    }}
                    title={hasExplanation ? 'Click for explanation' : undefined}
                  >
                    {b.label}
                  </button>
                )
              })}
            </div>
            {explanation && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: `1px solid ${(COMPONENT_BADGES[componentId].find(b => b.label === expandedBadge)?.color) || color}40`,
                  background: 'rgba(0,0,0,0.35)',
                  fontSize: '0.74rem',
                  lineHeight: 1.7,
                  color: 'var(--tx)',
                }}
              >
                {explanation}
              </div>
            )}
          </div>
        )
      })()}

      {component.logicalContext && (
        <div className="detail-section">
          <h4>OpenShift Context</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--tx-muted)' }}>
              Project:&nbsp;
              <span style={{ color, fontFamily: 'monospace' }}>
                {component.logicalContext.openShiftProject}
              </span>
            </div>
            {component.logicalContext.associatedObject && (
              <div style={{ fontSize: '0.72rem', color: 'var(--tx-muted)' }}>
                Object:&nbsp;
                <span style={{ color, fontFamily: 'monospace' }}>
                  {component.logicalContext.associatedObject}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {primitiveSet && (
        <div className="detail-section">
          <h4>{primitiveSet.sectionTitle}</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {primitiveSet.items.map(p => {
              const isExpanded = expandedPrimitive === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => setExpandedPrimitive(isExpanded ? null : p.id)}
                  className="node-badge"
                  style={{
                    color: isExpanded ? 'var(--bg)' : primitiveSet.color,
                    borderColor: primitiveSet.color,
                    background: isExpanded ? primitiveSet.color : `${primitiveSet.color}1a`,
                    fontSize: '0.62rem',
                    padding: '3px 8px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!isExpanded) e.currentTarget.style.background = `${primitiveSet.color}35`
                  }}
                  onMouseLeave={e => {
                    if (!isExpanded) e.currentTarget.style.background = `${primitiveSet.color}1a`
                  }}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
          {expandedPrimitive && (
            <PrimitiveInline
              primitive={primitiveSet.items.find(p => p.id === expandedPrimitive)}
              color={primitiveSet.color}
            />
          )}
        </div>
      )}

      <div className="detail-section">
        <h4>Problem solved</h4>
        <p>{component.problemSolved}</p>
      </div>

      {component.interactions?.length > 0 && (
        <div className="detail-section" style={{ color }}>
          <h4 style={{ color: 'var(--tx-muted)' }}>Interactions</h4>
          <ul>
            {component.interactions.map((i, idx) => (
              <li key={idx} style={{ color: 'var(--tx)' }}>
                <span style={{ color }}>{i}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {component.explorationCommands?.length > 0 && (
        <div className="detail-section">
          <h4>Explore</h4>
          <ExploreCommands commands={component.explorationCommands} color={color} />
        </div>
      )}

      <div
        className="text-[0.6rem] mt-6 pt-4 border-t"
        style={{ color: 'var(--tx-dim)', borderColor: 'var(--border-d)' }}
      >
        Press <span style={{ color: 'var(--tx-muted)' }}>Esc</span> to close · id:&nbsp;
        <span style={{ color: 'var(--tx-muted)' }}>{component.componentId}</span>
      </div>
    </aside>
  )
}
