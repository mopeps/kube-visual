import { useState } from 'react'
import { PIPELINE_LAYER_BY_ID } from '../data/pipeline-layers'
import ExploreCommands from './ExploreCommands'

// Compose the monospace gutter for a node: one cell per ancestor (spine or gap)
// plus this node's branch glyph. Produces a true ASCII tree.
function gutter(ancestorsLast, isLast) {
  let s = ''
  for (const last of ancestorsLast) s += last ? '   ' : '│  '
  return s + (isLast ? '└─ ' : '├─ ')
}

// Flatten a node spec tree (DFS) into ordered rows carrying their gutter prefix.
function flatten(node, ancestorsLast, isLast, out) {
  out.push({ node, prefix: gutter(ancestorsLast, isLast) })
  const kids = node.children || []
  kids.forEach((k, i) => flatten(k, [...ancestorsLast, isLast], i === kids.length - 1, out))
}

function RowDetail({ detail, color }) {
  return (
    <div className="tree-detail">
      {detail.lines?.map((l, i) => (
        <div key={`l${i}`} className="tree-detail-line">{l}</div>
      ))}
      {detail.bullets?.map((b, i) => (
        <div key={`b${i}`} className="tree-detail-bullet">• {b}</div>
      ))}
      {detail.kv?.map((p, i) => (
        <div key={`k${i}`} className="tree-detail-kv">
          <span className="tree-detail-k">{p.k}</span>
          <span className="tree-detail-v">{p.v}</span>
        </div>
      ))}
      {detail.commands?.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <ExploreCommands commands={detail.commands} color={color} />
        </div>
      )}
    </div>
  )
}

function Row({ row, bandColor }) {
  const [open, setOpen] = useState(false)
  const { node, prefix } = row
  const color = node.color || bandColor
  const hasDetail = !!node.detail
  return (
    <div className="tree-row">
      <span className="tree-gutter">{prefix}</span>
      <div className="tree-body">
        <button
          type="button"
          className="tree-row-head"
          onClick={hasDetail ? () => setOpen(o => !o) : undefined}
          aria-expanded={hasDetail ? open : undefined}
          style={{ color, cursor: hasDetail ? 'pointer' : 'default' }}
        >
          <span className="tree-label">{node.label}</span>
          {hasDetail && <span className="tree-toggle">{open ? '⊟' : '⊕'}</span>}
        </button>
        {node.note && <div className="tree-note">{'➔'} {node.note}</div>}
        {hasDetail && open && <RowDetail detail={node.detail} color={color} />}
      </div>
    </div>
  )
}

function Band({ layerId, groups, last }) {
  const layer = PIPELINE_LAYER_BY_ID[layerId]
  const color = `var(${layer.colorVar})`
  return (
    <div className="tree-band">
      <div className="tree-band-head" style={{ color }}>
        <span className="tree-band-num" style={{ borderColor: color }}>{layer.order}</span>
        <span className="tree-band-icon" aria-hidden="true">{layer.icon}</span>
        <span className="tree-band-title">{layer.label}</span>
      </div>
      {groups.map((g, gi) => {
        const rows = []
        g.nodes.forEach((n, i) => flatten(n, [], i === g.nodes.length - 1, rows))
        return (
          <div className="tree-group" key={gi}>
            {g.subhead && <div className="tree-subhead" style={{ color }}>{g.subhead}</div>}
            {rows.map((r, i) => <Row key={i} row={r} bandColor={color} />)}
          </div>
        )
      })}
      {!last && <div className="tree-connector" style={{ color }}>{'▼'}</div>}
    </div>
  )
}

// Pure renderer for a pre-built band model (see data/pipeline-model.js).
export default function PipelineTree({ bands }) {
  if (!bands?.length) return null
  return (
    <div className="pipeline-tree">
      {bands.map((b, i) => (
        <Band key={`${b.layerId}-${i}`} layerId={b.layerId} groups={b.groups} last={i === bands.length - 1} />
      ))}
    </div>
  )
}
