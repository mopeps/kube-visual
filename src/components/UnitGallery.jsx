import { useState } from 'react'
import { ManifestBlock } from './Manifest'

// A chip-selectable gallery of example unit files. Each chip is a unit (its
// .type shown as a kind tag); selecting one reveals a one-line "what it does"
// plus the unit body and its notable directives as keyword chips. Keeps the
// popup keyword-first and visual rather than a wall of prose.
export default function UnitGallery({ units, color = 'var(--k-cyan)' }) {
  const [activeId, setActiveId] = useState(units[0]?.id)
  const active = units.find((u) => u.id === activeId) || units[0]

  return (
    <div className="unit-gallery">
      <div className="unit-gallery-chips">
        {units.map((u) => {
          const on = u.id === active.id
          return (
            <button
              key={u.id}
              type="button"
              className={`unit-chip ${on ? 'is-active' : ''}`}
              style={{ '--unit-accent': color }}
              onClick={() => setActiveId(u.id)}
              title={u.summary}
            >
              <span className="unit-chip-name">{u.name}</span>
              <span className="unit-chip-kind">{u.kind}</span>
            </button>
          )
        })}
      </div>

      {active && (
        <div className="unit-gallery-detail">
          <div className="unit-gallery-tagline">
            <span className="unit-gallery-tag" style={{ color }}>{active.tag}</span>
            <p>{active.summary}</p>
          </div>
          {active.directives?.length > 0 && (
            <div className="unit-gallery-directives">
              {active.directives.map((d) => (
                <code key={d} className="unit-directive" style={{ '--unit-accent': color }}>{d}</code>
              ))}
            </div>
          )}
          <ManifestBlock body={active.body} kind="UNIT" color={color} />
        </div>
      )}
    </div>
  )
}
