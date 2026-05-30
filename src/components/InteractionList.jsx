import { classifyInteraction, INTERACTION_KINDS } from '../data/interaction-kinds'
import ObjectText from './ObjectText'

// Small inline icons (16×16, stroke = currentColor) used to telegraph each
// interaction's relationship kind. Kept here so the SVG markup stays out of the
// row-rendering loop below.
function KindIcon({ name }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
  switch (name) {
    case 'eye':
      return (
        <svg {...common}>
          <path d="M1.5 8S3.8 3.5 8 3.5 14.5 8 14.5 8 12.2 12.5 8 12.5 1.5 8 1.5 8Z" />
          <circle cx="8" cy="8" r="2" />
        </svg>
      )
    case 'in':
      // arrow entering a wall on the right → flows toward this component
      return (
        <svg {...common}>
          <path d="M2 8h7.5" />
          <path d="M6.5 5 9.5 8l-3 3" />
          <path d="M13 2.5v11" />
        </svg>
      )
    case 'out':
      // arrow leaving a wall on the left → this component acts outward
      return (
        <svg {...common}>
          <path d="M3 2.5v11" />
          <path d="M6.5 8H14" />
          <path d="M11 5l3 3-3 3" />
        </svg>
      )
    case 'gear':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="2.4" />
          <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" />
        </svg>
      )
    case 'spark':
      // two plus-marks (one large, one small) — bringing new things into being
      return (
        <svg {...common}>
          <path d="M6.5 2.2v6.6M3.2 5.5h6.6" />
          <path d="M11.8 9.4v4M9.8 11.4h4" />
        </svg>
      )
    case 'note':
    default:
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.2" />
          <path d="M8 7.2v4" />
          <circle cx="8" cy="5" r="0.2" />
        </svg>
      )
  }
}

// The detail-modal "Interactions" section. Each free-text interaction is
// classified (see interaction-kinds.js) into a relationship kind, then rendered
// as a row whose leading icon + accent colour convey direction/type at a glance
// while the full sentence is preserved. A compact legend above the rows ties
// the icons to their meaning so the visual language is self-explanatory.
export default function InteractionList({ interactions, onSelectComponent, selfId }) {
  const rows = interactions.map((text) => classifyInteraction(text))

  // Only legend-list the kinds actually present in this component's rows, in a
  // stable order, so the key never advertises an icon the user can't see below.
  const order = ['inbound', 'outbound', 'observe', 'create', 'manage', 'note']
  const presentKinds = order.filter((k) => rows.some((r) => r.kind === k))

  return (
    <div className="detail-section">
      <h4>Interactions</h4>

      {presentKinds.length > 1 && (
        <div className="interaction-legend">
          {presentKinds.map((k) => {
            const meta = INTERACTION_KINDS[k]
            return (
              <span key={k} className="interaction-legend-item" style={{ color: meta.accent }}>
                <span className="interaction-legend-icon"><KindIcon name={meta.icon} /></span>
                {meta.label}
              </span>
            )
          })}
        </div>
      )}

      <ul className="interaction-list">
        {rows.map((r, idx) => (
          <li key={idx} className="interaction-row">
            <span
              className="interaction-icon"
              style={{
                color: r.kindMeta.accent,
                borderColor: `${r.kindMeta.accent}55`,
                background: `${r.kindMeta.accent}14`,
              }}
              aria-hidden="true"
            >
              <KindIcon name={r.kindMeta.icon} />
            </span>
            <span className="interaction-text">
              {r.verb && (
                <span className="interaction-verb" style={{ color: r.kindMeta.accent }}>
                  {r.verb}{' '}
                </span>
              )}
              <ObjectText text={r.rest} onSelectComponent={onSelectComponent} selfId={selfId} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
