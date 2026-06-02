import { classifyInteraction, INTERACTION_KINDS } from '../data/interaction-kinds'
import InteractionRow, { KindIcon } from './InteractionRow'

// The detail-modal relationship rows. Each free-text interaction is classified
// (see interaction-kinds.js) into a relationship kind, then rendered as a row
// whose leading icon + accent colour convey direction/type at a glance while
// the full sentence is preserved (the row itself lives in InteractionRow, shared
// with the pipeline tree's revealed detail). A compact legend above the rows ties
// the icons to their meaning so the visual language is self-explanatory.
//
// Headingless by design: it renders directly beneath the "why it exists"
// callout inside one merged section (see DetailSections), so the rows read as a
// continuation of that point rather than a separately-titled block.
export default function InteractionList({ interactions, onSelectComponent, selfId }) {
  const kinds = interactions.map((text) => classifyInteraction(text).kind)

  // Only legend-list the kinds actually present in this component's rows, in a
  // stable order, so the key never advertises an icon the user can't see below.
  const order = ['inbound', 'outbound', 'observe', 'create', 'manage', 'note']
  const presentKinds = order.filter((k) => kinds.includes(k))

  return (
    <div className="interaction-block">
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
        {interactions.map((text, idx) => (
          <InteractionRow
            key={idx}
            text={text}
            onSelectComponent={onSelectComponent}
            selfId={selfId}
          />
        ))}
      </ul>
    </div>
  )
}
