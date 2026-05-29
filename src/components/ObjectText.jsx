import { Fragment } from 'react'
import { COMPONENT_COLOR } from '../data/zones'
import { tokenizeObjectRefs } from '../data/object-tags'

// Renders a prose string with any recognised OpenShift / Kubernetes object
// reference (see object-tags.js) lifted out as an inline tag chip:
//   • objects that are nodes on the topology become navigable buttons tinted
//     with the node's zone accent — clicking one opens that node via
//     `onSelectComponent`;
//   • other API objects render as a muted, non-clickable highlight chip.
//
// `selfId` is the component currently shown in the modal; a chip pointing at it
// is rendered static (non-navigable) so a node never links to itself.
export default function ObjectText({ text, onSelectComponent, selfId }) {
  const tokens = tokenizeObjectRefs(text)

  return (
    <>
      {tokens.map((t, i) => {
        if (t.type === 'text') return <Fragment key={i}>{t.value}</Fragment>

        const navigable = !!(t.componentId && t.componentId !== selfId && onSelectComponent)
        const color = t.componentId
          ? COMPONENT_COLOR[t.componentId] || 'var(--k-cyan)'
          : 'var(--tx-muted)'

        if (navigable) {
          return (
            <button
              key={i}
              type="button"
              className="object-tag"
              style={{ '--object-tag-color': color }}
              onClick={(e) => {
                e.stopPropagation()
                onSelectComponent(t.componentId)
              }}
              title={`Open ${t.value}`}
            >
              {t.value}
            </button>
          )
        }

        return (
          <span
            key={i}
            className="object-tag object-tag--static"
            style={{ '--object-tag-color': color }}
          >
            {t.value}
          </span>
        )
      })}
    </>
  )
}
