import { useEffect, useState } from 'react'
import componentsData from '../data/components.json'
import { COMPONENT_COLOR, COMPONENT_ZONE } from '../data/zones'

export default function DetailPanel({ componentId, onClose }) {
  const [copiedIndex, setCopiedIndex] = useState(null)

  useEffect(() => {
    if (!componentId) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [componentId, onClose])

  if (!componentId) return <aside className="detail-panel" aria-hidden="true" />

  const component = componentsData.find(c => c.componentId === componentId)
  if (!component) return <aside className="detail-panel" aria-hidden="true" />

  const color = COMPONENT_COLOR[componentId] || 'var(--k-cyan)'
  const zone = COMPONENT_ZONE[componentId]

  const copy = (text, i) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(i)
      setTimeout(() => setCopiedIndex(null), 1800)
    })
  }

  return (
    <aside className="detail-panel is-open" role="dialog" aria-label={component.displayName}>
      <button className="detail-close" onClick={onClose} aria-label="Close (Esc)">
        ✕
      </button>

      <div className="detail-title" style={{ color }}>
        {component.displayName}
      </div>
      <div className="detail-type" style={{ color }}>
        {zone?.label || component.layer}
      </div>

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {component.explorationCommands.map((cmd, i) => (
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
