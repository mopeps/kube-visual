import { classifyInteraction } from '../data/interaction-kinds'
import ObjectText from './ObjectText'

// The detail-modal relationship rows. Each free-text interaction is classified
// (see interaction-kinds.js) into a relationship kind; the leading verb is
// emphasised in that kind's accent colour while the full sentence is preserved.
//
// Headingless by design: it renders directly beneath the "why it exists"
// callout inside one merged section (see DetailSections), so the rows read as a
// continuation of that point rather than a separately-titled block.
export default function InteractionList({ interactions, onSelectComponent, selfId }) {
  const rows = interactions.map((text) => classifyInteraction(text))

  return (
    <div className="interaction-block">
      <ul className="interaction-list">
        {rows.map((r, idx) => (
          <li key={idx} className="interaction-row">
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
