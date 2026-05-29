import { useState } from 'react'
import { PIPELINE_LAYER_BY_ID } from '../data/pipeline-layers'
import ExploreCommands from './ExploreCommands'

// Monochrome line glyphs for the pipeline bands. Each is a single-stroke SVG
// drawn with `currentColor`, so it inherits the band head's accent color, and
// sized at 1em so it tracks `.tree-band-icon`'s font-size. Keyed by the layer's
// `icon` id in pipeline-layers.js.
const BAND_GLYPHS = {
  // Logical Intent — a manifest/document with text lines and a folded corner.
  document: <><path d="M6 2.8h7l5 5v13.4H6z" /><path d="M13 2.8v5h5" /><path d="M9 12h6M9 15h6M9 9h3" /></>,
  // Runtime Object — an isometric cube / packaged object.
  cube: <><path d="M12 2.5 4 7v10l8 4.5 8-4.5V7z" /><path d="m4 7 8 4.5L20 7" /><path d="M12 11.5V21" /></>,
  // Translation Engine — a toothed cog / gear (machinery), not a radial sun.
  gear: <><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  // Consumed Resources — stacked layers folded into the Pod.
  layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
  // Linux Kernel Primitives — a microchip / CPU with pins.
  chip: <><rect x="7" y="7" width="10" height="10" rx="1" /><rect x="10.5" y="10.5" width="3" height="3" /><path d="M10 7V4M14 7V4M10 20v-3M14 20v-3M7 10H4M7 14H4M20 10h-3M20 14h-3" /></>,
}

function BandIcon({ name }) {
  const glyph = BAND_GLYPHS[name]
  if (!glyph) return null
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {glyph}
    </svg>
  )
}

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
        <span className="tree-band-icon" aria-hidden="true"><BandIcon name={layer.icon} /></span>
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
