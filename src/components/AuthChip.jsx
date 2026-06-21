import { useState } from 'react'
import { findAuth } from '../data/auth-flows'
import HopIcon from './HopIcon'

// The authentication marker on a trace hop. An authenticated edge carries an
// `auth` mechanism id (auth-flows.js); this renders it as a small padlock keyword
// chip and, when clicked, expands the actual authn → authz sub-steps inline — the
// "clickable depth". Auth is an edge attribute, so it is never a node/hop on the
// canvas; the detail lives here, on demand. Renders nothing when the hop has no
// `auth` (e.g. every data-plane hop), which is itself the point: absence = the
// platform doesn't authenticate that path.
export default function AuthChip({ authId, color }) {
  const auth = findAuth(authId)
  const [open, setOpen] = useState(false)
  if (!auth) return null
  return (
    <div className="auth-chip-wrap" style={color ? { '--hop-accent': color } : undefined}>
      <button
        type="button"
        className={`auth-chip ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        title={open ? 'Hide authentication steps' : 'Show how this hop is authenticated'}
      >
        <span className="auth-chip-ic" aria-hidden><HopIcon name="lock" /></span>
        <span className="auth-chip-label">{auth.label}</span>
        <span className="auth-chip-caret" aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="auth-detail" onClick={(e) => e.stopPropagation()}>
          <p className="auth-detail-summary">{auth.summary}</p>
          <ol className="auth-steps">
            {auth.steps.map((s, i) => (
              <li key={i} className="auth-step">
                <span className="auth-step-k" style={color ? { color } : undefined}>{s.k}</span>
                <span className="auth-step-v">{s.v}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
