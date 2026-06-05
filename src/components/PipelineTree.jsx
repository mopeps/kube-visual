import { useState } from 'react'
import { PIPELINE_LAYER_BY_ID } from '../data/pipeline-layers'
import { classifyRow } from '../data/pipeline-kinds'
import ExploreCommands from './ExploreCommands'
import ObjectText from './ObjectText'
import InteractionRow from './InteractionRow'
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

// The key glyph that fronts a row's definition callout — the same "essential
// reason" mark the detail modal's opening why-callout uses (DetailSections.jsx),
// so a revealed pipeline row leads with the identical visual cue as the object's
// first section, just one level in. Drawn at 1em to track the chip's font-size.
// Used as the fallback when a row carries a definition but no classified action.
function KeyGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="5.5" cy="5.5" r="3.2" />
      <path d="M7.8 7.8 13 13" />
      <path d="M11 11l1.6-1.6M12.4 12.4 14 10.8" />
    </svg>
  )
}

// Glyph for the row's *action keyword* (Declared / Mounted / Routed / Built …),
// keyed by the `icon` each entry in PIPELINE_ACTIONS declares. So the mark that
// leads a reveal matches what the keyword says happens at that step, instead of a
// generic key. Same drawing conventions as HopIcon / KindIcon (16-unit viewBox,
// ~1.6 stroke, currentColor), sized 15px to match KeyGlyph. The shared shapes
// (document/loop/disk/cube/route/run) mirror HopIcon so the whole app reads in
// one visual language; mount/shield/build/isolate are added here.
function ActionGlyph({ name }) {
  const common = {
    width: 15, height: 15, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
  }
  switch (name) {
    case 'document': // Declared — a manifest page
      return (<svg {...common}><path d="M4 2.2h5l3 3v8.6H4z" /><path d="M9 2.2v3h3" /><path d="M6 8.5h4M6 10.8h4" /></svg>)
    case 'loop': // Reconciles — circular arrows
      return (<svg {...common}><path d="M13 7a5 5 0 0 0-9-2" /><path d="M3 9a5 5 0 0 0 9 2" /><path d="M4 2.5V5h2.5" /><path d="M12 13.5V11H9.5" /></svg>)
    case 'disk': // Stored — a database cylinder
      return (<svg {...common}><ellipse cx="8" cy="3.8" rx="5" ry="1.8" /><path d="M3 3.8v8.4c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V3.8" /><path d="M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8" /></svg>)
    case 'cube': // Scheduled — a packaged object placed
      return (<svg {...common}><path d="M8 2 14 5v6l-6 3-6-3V5z" /><path d="m2 5 6 3 6-3" /><path d="M8 8v6" /></svg>)
    case 'mount': // Mounted — an arrow seated down onto a mount point
      return (<svg {...common}><path d="M8 2v5.5" /><path d="M5.5 5 8 7.5 10.5 5" /><path d="M2.5 10.5h11" /><path d="M4.5 10.5v2.5M11.5 10.5v2.5" /></svg>)
    case 'route': // Routed — a path branching to a node
      return (<svg {...common}><circle cx="3" cy="8" r="1.4" /><circle cx="13" cy="3.6" r="1.4" /><circle cx="13" cy="12.4" r="1.4" /><path d="M4.4 8h3.2M11.6 4.4 8 6.2 11.6 11.6" /></svg>)
    case 'shield': // Filtered — a shield guarding traffic
      return (<svg {...common}><path d="M8 2.2 13 4.2v3.9c0 3-2.1 4.9-5 5.7-2.9-.8-5-2.7-5-5.7V4.2z" /><path d="M5.9 7.9 7.4 9.4 10.3 6.3" /></svg>)
    case 'build': // Built — stacked layers assembled into a bundle
      return (<svg {...common}><rect x="2.6" y="8.6" width="10.8" height="3.4" rx="0.6" /><rect x="4.6" y="4.6" width="6.8" height="3.4" rx="0.6" /></svg>)
    case 'run': // Runs — a play triangle
      return (<svg {...common}><path d="M5 3.2 12.5 8 5 12.8z" /></svg>)
    case 'isolate': // Isolated — a boundary enclosing a contained inner space
      return (<svg {...common}><rect x="2.4" y="2.4" width="11.2" height="11.2" rx="2.2" /><rect x="6" y="6" width="4" height="4" rx="0.9" /></svg>)
    default:
      return <KeyGlyph />
  }
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

// The revealed detail under a node, shown beneath the definition callout. Its
// content is rendered in the same visual language as the detail-modal Interactions
// section so the two read as one:
//   • lines   → any supplementary prose with no leading verb to classify,
//               set white as body prose (no kind-glyph / keyword);
//   • bullets → the row's mechanics, each an interaction-style row (kind-icon
//               chip + emphasised verb + sentence) via the shared InteractionRow —
//               they're verb-led interaction sentences from the same source as
//               the Interactions section, so they classify the same way;
//   • kv      → tight key/value facts (host path, backing object);
//   • commands → copyable shell.
// Object references throughout are lifted (via ObjectText) into the same inline
// chips used by the why-callout and interaction rows, so the same nodes are
// navigable wherever they're named.
function RowDetail({ detail, color, onSelectComponent, selfId }) {
  return (
    <>
      {detail.lines?.map((l, i) => (
        <div key={`l${i}`} className="tree-detail-line">
          <ObjectText text={l} onSelectComponent={onSelectComponent} selfId={selfId} />
        </div>
      ))}
      {detail.bullets?.length > 0 && (
        <ul className="interaction-list tree-detail-interactions">
          {detail.bullets.map((b, i) => (
            <InteractionRow
              key={`b${i}`}
              text={b}
              onSelectComponent={onSelectComponent}
              selfId={selfId}
            />
          ))}
        </ul>
      )}
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
// clean list of labels. Child nodes render flush beneath their parent (no indent
// or rail) — each child's own accent colour marks it as a level down.
function Node({ node, bandColor, layerId, onSelectComponent, selfId }) {
  const [open, setOpen] = useState(false)
  const [manifestOpen, setManifestOpen] = useState(false)
  const color = node.color || bandColor
  const kids = node.children || []
  // The row's definition — what this thing is / the problem it solves. Primitives
  // carry their full description in `definition`; every other node's one-line
  // `note` plays the same part. Either leads the reveal as a key-glyph callout.
  const definition = node.definition || node.note
  // A row is expandable when it carries a definition, deeper detail, or an example
  // manifest to reveal.
  const hasExtra = !!definition || !!node.detail || !!node.manifest
  // Action keyword — tags the revealed description by *what the pipeline does* at
  // this step (Stored, Mounted, Routed, Runs …), colour-coded by accent. It's
  // rendered as a plain lead verb (the same `.interaction-verb` treatment the
  // Interactions section gives each line's verb), not a boxed badge, so it reads
  // as one family with those rows. It complements the row label (what the thing
  // is) rather than echoing it.
  const action = (definition || node.detail) ? classifyRow(node.label, layerId) : null

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
          {(definition || action) && (
            <div className="tree-why">
              <span
                className="tree-why-icon"
                aria-hidden="true"
                style={action ? { color: action.accent, borderColor: action.accent } : undefined}
              >
                {action ? <ActionGlyph name={action.icon} /> : <KeyGlyph />}
              </span>
              <div className="tree-why-body">
                <p className="tree-why-text">
                  {action && (
                    <span className="interaction-verb" style={{ color: action.accent }}>
                      {action.label}{' '}
                    </span>
                  )}
                  {definition && (
                    <ObjectText text={definition} onSelectComponent={onSelectComponent} selfId={selfId} />
                  )}
                </p>
              </div>
            </div>
          )}
          {node.detail && (
            <RowDetail detail={node.detail} color={color} onSelectComponent={onSelectComponent} selfId={selfId} />
          )}
          {node.manifest && (
            <div className="tree-manifest">
              <ManifestChip
                open={manifestOpen}
                onToggle={() => setManifestOpen(o => !o)}
                kind={node.manifest.kind}
                color={color}
              />
              {manifestOpen && (
                <ManifestBlock body={node.manifest.body} kind={node.manifest.kind} color={color} />
              )}
            </div>
          )}
        </div>
      )}

      {kids.length > 0 && (
        <div className="tree-children" style={{ '--row-color': color }}>
          {kids.map((k, i) => (
            <Node key={i} node={k} bandColor={bandColor} layerId={layerId} onSelectComponent={onSelectComponent} selfId={selfId} />
          ))}
        </div>
      )}
    </div>
  )
}

function Band({ layerId, groups, onSelectComponent, selfId }) {
  const layer = PIPELINE_LAYER_BY_ID[layerId]
  const color = `var(${layer.colorVar})`
  return (
    <div className="tree-band" style={{ '--band-color': color }}>
      <div className="tree-band-header">
        <div className="tree-band-icon" aria-hidden="true"><BandIcon name={layer.icon} /></div>
        <div className="tree-band-head" style={{ color }}>{layer.label}</div>
      </div>
      <div className="tree-band-body">
        {groups.map((g, gi) => (
          <div className="tree-group" key={gi}>
            {g.subhead && <div className="tree-subhead" style={{ color }}>{g.subhead}</div>}
            {g.nodes.map((n, i) => (
              <Node key={i} node={n} bandColor={color} layerId={layerId} onSelectComponent={onSelectComponent} selfId={selfId} />
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
          onSelectComponent={onSelectComponent}
          selfId={selfId}
        />
      ))}
    </div>
  )
}
