import { classifyInteraction } from '../data/interaction-kinds'
import ObjectText from './ObjectText'

// Small inline icons (16×16, stroke = currentColor) that telegraph each
// interaction's relationship kind. Shared by the detail-modal Interactions
// section (InteractionList) and the pipeline tree's revealed detail
// (PipelineTree), so a "Watches" / "Creates" / "Sends" line reads with the same
// glyph + accent wherever it appears.
export function KindIcon({ name }) {
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
    case 'document':
      // a manifest/spec page with a folded corner — declared desired state
      return (
        <svg {...common}>
          <path d="M4 1.8h5L12.2 5v9.2H4z" />
          <path d="M9 1.8V5h3.2" />
          <path d="M5.8 8h4.4M5.8 10.4h4.4" />
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

// One classified interaction line, rendered as a row: a kind-icon chip + an
// emphasised lead verb + the sentence (with object references lifted into inline
// chips by ObjectText). This is the single source of the row's look, so the
// Interactions section and the pipeline tree's revealed detail stay identical.
//
// Rendered as an <li>, so callers wrap a set of rows in a
// <ul className="interaction-list"> (which carries the shared list reset).
export default function InteractionRow({ text, onSelectComponent, selfId }) {
  const r = classifyInteraction(text)
  return (
    <li className="interaction-row">
      <span
        className="interaction-icon"
        style={{
          color: r.kindMeta.accent,
          borderColor: `${r.kindMeta.accent}55`,
          background: 'transparent',
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
  )
}
