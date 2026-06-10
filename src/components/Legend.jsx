import { useState } from 'react'
import { TypeGlyph, hasTypeGlyph } from './TypeIcon'

// The Overview's visual vocabulary, spelled out once: which colour means which
// zone of the stack, and which glyph + [bracket] label means which runtime
// form. Collapsed by default (same disclosure pattern as the deep-dive
// "About" toggle) so the canvas still leads.

const ZONE_KEYS = [
  { varName: '--k-cyan', label: 'External Client' },
  { varName: '--k-blue', label: 'Bare Metal Master' },
  { varName: '--k-blue-worker', label: 'Bare Metal Worker' },
  { varName: '--k-sky', label: 'HCP Namespace' },
  { varName: '--k-teal', label: 'KubeVirt Launcher' },
  { varName: '--k-green', label: 'Guest Worker VM' },
  { varName: '--packet', label: 'Active trace' },
]

// Every typePrefix used on the canvas; hasTypeGlyph keeps the list honest if a
// prefix ever loses (or gains) its glyph. [Pod] is listed first with a note —
// it's the default form, so node cards leave it unlabeled.
const TYPE_KEYS = [
  { prefix: 'Pod', note: 'unlabeled on cards' },
  { prefix: 'Static Pod' },
  { prefix: 'systemd' },
  { prefix: 'Service' },
  { prefix: 'VirtualMachineInstance' },
  { prefix: 'Custom Resource' },
  { prefix: 'API Object' },
  { prefix: 'NWPOLICY' },
  { prefix: 'Client' },
].filter(t => hasTypeGlyph(t.prefix))

export default function Legend() {
  const [open, setOpen] = useState(false)
  return (
    <div className="legend">
      <button
        type="button"
        className={`dd-about-toggle ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span className="dd-about-icon" aria-hidden>▦</span>
        Legend — zones &amp; runtime forms
        <span className="dd-about-chev" aria-hidden>⌄</span>
      </button>
      {open && (
        <div className="legend-body">
          <div className="legend-row">
            <span className="legend-key">Zones</span>
            {ZONE_KEYS.map(z => (
              <span key={z.varName} className="legend-chip">
                <span className="legend-swatch" style={{ background: `var(${z.varName})` }} />
                {z.label}
              </span>
            ))}
          </div>
          <div className="legend-row">
            <span className="legend-key">Forms</span>
            {TYPE_KEYS.map(t => (
              <span key={t.prefix} className="legend-chip">
                <span className="legend-glyph" aria-hidden><TypeGlyph typePrefix={t.prefix} /></span>
                [{t.prefix}]{t.note ? <span className="legend-note"> — {t.note}</span> : null}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
