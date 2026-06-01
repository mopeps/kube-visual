import { useState } from 'react'
import { PIPELINE_LAYER_BY_ID } from '../data/pipeline-layers'
import { classifyRow } from '../data/pipeline-kinds'
import ExploreCommands from './ExploreCommands'
import ObjectText from './ObjectText'
import { ManifestChip, ManifestBlock } from './Manifest'

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

// Line glyphs for the action chip that leads a revealed description. Drawn in the
// same style as the interaction-row icons (InteractionList.jsx) and band glyphs: a
// 16-unit viewBox with round caps/joins and currentColor stroke, so each inherits
// its action accent. The 2.0 stroke at this 13px render lands at the same ~1.5px
// effective weight those icons carry (the interaction icons reach it at 15px × 1.6).
function KindGlyph({ name }) {
  const c = {
    width: 13, height: 13, viewBox: '0 0 16 16', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2.0, strokeLinecap: 'round', strokeLinejoin: 'round',
  }
  switch (name) {
    case 'disk': // store — a database cylinder
      return <svg {...c}><ellipse cx="8" cy="4" rx="5" ry="2" /><path d="M3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4" /><path d="M3 8c0 1.1 2.2 2 5 2s5-.9 5-2" /></svg>
    case 'loop': // reconcile — two curved arrows chasing a loop
      return <svg {...c}><path d="M12.5 7a4.5 4.5 0 0 0-8-2.2" /><path d="M3.5 9a4.5 4.5 0 0 0 8 2.2" /><path d="M4 2.5V5h2.5" /><path d="M12 13.5V11H9.5" /></svg>
    case 'mount': // mount — arrow dropping onto a shelf
      return <svg {...c}><path d="M8 2v6.5" /><path d="M5.5 6 8 8.5 10.5 6" /><path d="M3 11.5h10" /></svg>
    case 'route': // route — a node forking out to two paths
      return <svg {...c}><circle cx="3" cy="8" r="1.2" /><path d="M4.4 8H7.5" /><path d="M7.5 8 11 4.8h1.8" /><path d="M7.5 8 11 11.2h1.8" /></svg>
    case 'shield': // filter — a guard shield
      return <svg {...c}><path d="M8 1.8 13 3.6v3.6c0 3.3-2.4 5.2-5 6.6-2.6-1.4-5-3.3-5-6.6V3.6z" /></svg>
    case 'build': // built — an assembled package/cube
      return <svg {...c}><path d="M8 1.8 13.5 5 8 8.2 2.5 5z" /><path d="M2.5 5v6L8 14.2 13.5 11V5" /><path d="M8 8.2V14" /></svg>
    case 'run': // runs — a play triangle
      return <svg {...c}><path d="M5 3.5 12 8l-7 4.5z" /></svg>
    case 'isolate': // isolated — four corner brackets enclosing
      return <svg {...c}><path d="M5.5 2.5H4A1.5 1.5 0 0 0 2.5 4v1.5" /><path d="M10.5 2.5H12A1.5 1.5 0 0 1 13.5 4v1.5" /><path d="M13.5 10.5V12a1.5 1.5 0 0 1-1.5 1.5h-1.5" /><path d="M5.5 13.5H4A1.5 1.5 0 0 1 2.5 12v-1.5" /></svg>
    default:
      return null
  }
}

// Object references in the revealed detail are lifted (via ObjectText) into the
// same inline chips used by the why-callout and interaction rows, so the same
// nodes are navigable wherever they're named.
function RowDetail({ detail, color, onSelectComponent, selfId }) {
  return (
    <>
      {detail.lines?.map((l, i) => (
        <div key={`l${i}`} className="tree-detail-line">
          <ObjectText text={l} onSelectComponent={onSelectComponent} selfId={selfId} />
        </div>
      ))}
      {detail.bullets?.map((b, i) => (
        <div key={`b${i}`} className="tree-detail-bullet">
          <span className="tree-detail-marker" style={{ color }} aria-hidden="true">•</span>
          <span><ObjectText text={b} onSelectComponent={onSelectComponent} selfId={selfId} /></span>
        </div>
      ))}
      {detail.kv?.map((p, i) => (
        <div key={`k${i}`} className="tree-detail-kv">
          <span className="tree-detail-k">{p.k}</span>
          <span className="tree-detail-v">
            <ObjectText text={p.v} onSelectComponent={onSelectComponent} selfId={selfId} />
          </span>
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
function Node({ node, bandColor, onSelectComponent, selfId }) {
  const [open, setOpen] = useState(false)
  const [manifestOpen, setManifestOpen] = useState(false)
  const color = node.color || bandColor
  const kids = node.children || []
  // A row is expandable when it carries a note or deeper detail to reveal.
  const hasExtra = !!node.note || !!node.detail
  // Action chip — tags the revealed description by *what the pipeline does* at
  // this step (Stored, Mounted, Routed, Runs …), colour-coded by accent the way
  // the Interactions section tags each line by its verb. It complements the row
  // label (what the thing is) rather than echoing it.
  const action = hasExtra ? classifyRow(node.label) : null

  return (
    <div className="tree-node">
      <div className="tree-row-line">
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
        {node.manifest && (
          <ManifestChip
            open={manifestOpen}
            onToggle={() => setManifestOpen(o => !o)}
            kind={node.manifest.kind}
            color={color}
          />
        )}
      </div>

      {node.manifest && manifestOpen && (
        <div className="tree-reveal" style={{ '--row-color': color }}>
          <ManifestBlock body={node.manifest.body} kind={node.manifest.kind} color={color} />
        </div>
      )}

      {hasExtra && open && (
        <div className="tree-reveal" style={{ '--row-color': color }}>
          {(action || node.note) && (
            <div className="tree-note">
              {action && (
                <span className="tree-kind-chip" style={{ color: action.accent }}>
                  <span className="tree-kind-chip-icon" aria-hidden="true"><KindGlyph name={action.icon} /></span>
                  {action.label}
                </span>
              )}
              {node.note && <ObjectText text={node.note} onSelectComponent={onSelectComponent} selfId={selfId} />}
            </div>
          )}
          {node.detail && (
            <RowDetail detail={node.detail} color={color} onSelectComponent={onSelectComponent} selfId={selfId} />
          )}
        </div>
      )}

      {kids.length > 0 && (
        <div className="tree-children" style={{ '--row-color': color }}>
          {kids.map((k, i) => (
            <Node key={i} node={k} bandColor={bandColor} onSelectComponent={onSelectComponent} selfId={selfId} />
          ))}
        </div>
      )}
    </div>
  )
}

function Band({ layerId, groups, last, onSelectComponent, selfId }) {
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
            {g.nodes.map((n, i) => (
              <Node key={i} node={n} bandColor={color} onSelectComponent={onSelectComponent} selfId={selfId} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// Pure renderer for a pre-built band model (see data/pipeline-model.js).
// `onSelectComponent` / `selfId` are threaded down so object references inside a
// row's revealed detail become the same navigable chips the rest of the modal uses.
export default function PipelineTree({ bands, onSelectComponent, selfId }) {
  if (!bands?.length) return null
  return (
    <div className="pipeline-tree">
      {bands.map((b, i) => (
        <Band
          key={`${b.layerId}-${i}`}
          layerId={b.layerId}
          groups={b.groups}
          last={i === bands.length - 1}
          onSelectComponent={onSelectComponent}
          selfId={selfId}
        />
      ))}
    </div>
  )
}
