import { useState } from 'react'
import { PIPELINE_LAYER_BY_ID } from '../data/pipeline-layers'
import ExploreCommands from './ExploreCommands'

// Monochrome line glyphs for the pipeline bands. Each is a single-stroke SVG
// drawn with `currentColor`, so it inherits the band head's accent color, and
// sized at 1em so it tracks `.tree-band-icon`'s font-size. The stroke weight is
// tuned to match the detail-modal interaction icons (.interaction-icon): once the
// 24-unit viewBox is scaled down by `.tree-band-icon`'s 1.15rem font-size, a 2.0
// stroke lands at the same ~1.5px effective weight the 16-unit interaction icons
// draw at. Keyed by the layer's `icon` id in pipeline-layers.js.
const BAND_GLYPHS = {
  // Logical Intent — a manifest/document with text lines and a folded corner.
  document: <><path d="M6 2.8h7l5 5v13.4H6z" /><path d="M13 2.8v5h5" /><path d="M9 12h6M9 15h6M9 9h3" /></>,
  // Runtime Object — an isometric cube / packaged object.
  cube: <><path d="M12 2.5 4 7v10l8 4.5 8-4.5V7z" /><path d="m4 7 8 4.5L20 7" /><path d="M12 11.5V21" /></>,
  // Translation Engine — an electric motor: a body block with a central rotor,
  // an output shaft, and two mounting feet. Reads as the machinery that does the
  // work of turning API objects into running processes, more literally than a
  // bare gear did.
  engine: <><rect x="4" y="6.5" width="11" height="10" rx="2" /><circle cx="9.5" cy="11.5" r="2.6" /><path d="M15 11.5h4" /><path d="M6.5 16.5v2M12.5 16.5v2" /></>,
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
      strokeWidth="2.0"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {glyph}
    </svg>
  )
}

function RowDetail({ detail, color }) {
  return (
    <>
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
    </>
  )
}

// A single node row. The label is always shown; the one-line note and any deeper
// detail are hidden until the row is expanded, so the resting state is just a
// clean list of labels. Child nodes render indented beneath, threaded by a soft
// accent rail rather than ASCII gutter glyphs.
function Node({ node, bandColor }) {
  const [open, setOpen] = useState(false)
  const color = node.color || bandColor
  const kids = node.children || []
  // A row is expandable when it carries a note or deeper detail to reveal.
  const hasExtra = !!node.note || !!node.detail

  return (
    <div className="tree-node">
      <button
        type="button"
        className="tree-row-head"
        onClick={hasExtra ? () => setOpen(o => !o) : undefined}
        aria-expanded={hasExtra ? open : undefined}
        data-expandable={hasExtra ? '' : undefined}
        style={{ color, cursor: hasExtra ? 'pointer' : 'default' }}
      >
        {hasExtra && (
          <span className={`tree-caret${open ? ' is-open' : ''}`} aria-hidden="true">▸</span>
        )}
        <span className="tree-label">{node.label}</span>
      </button>

      {hasExtra && open && (
        <div className="tree-reveal" style={{ '--row-color': color }}>
          {node.note && <div className="tree-note">{node.note}</div>}
          {node.detail && <RowDetail detail={node.detail} color={color} />}
        </div>
      )}

      {kids.length > 0 && (
        <div className="tree-children" style={{ '--row-color': color }}>
          {kids.map((k, i) => <Node key={i} node={k} bandColor={bandColor} />)}
        </div>
      )}
    </div>
  )
}

function Band({ layerId, groups, last }) {
  const layer = PIPELINE_LAYER_BY_ID[layerId]
  const color = `var(${layer.colorVar})`
  return (
    <div className={`tree-band${last ? ' is-last' : ''}`} style={{ '--band-color': color }}>
      <div className="tree-band-icon" aria-hidden="true"><BandIcon name={layer.icon} /></div>
      <div className="tree-band-head" style={{ color }}>{layer.label}</div>
      <div className="tree-band-body">
        {groups.map((g, gi) => (
          <div className="tree-group" key={gi}>
            {g.subhead && <div className="tree-subhead" style={{ color }}>{g.subhead}</div>}
            {g.nodes.map((n, i) => <Node key={i} node={n} bandColor={color} />)}
          </div>
        ))}
      </div>
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
