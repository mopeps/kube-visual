import { useState } from 'react'
import { copyToClipboard } from './ExploreCommands'

// The clickable chip-badge that opens an object's minimal example manifest.
// Styled exactly like the detail-modal concept badges (.node-badge) so it reads
// as one of the same family wherever it appears — the detail header row and the
// pipeline's logical-intent node both render this identical chip.
//   kind: 'MANIFEST' → a Kubernetes YAML object
//         'UNIT'     → a systemd unit file (host services have no K8s manifest)
export function ManifestChip({ open, onToggle, kind = 'MANIFEST', color }) {
  return (
    <button
      type="button"
      className="node-badge manifest-chip"
      aria-expanded={open}
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      style={{
        color: open ? 'var(--bg)' : color,
        borderColor: color,
        background: open ? color : `${color}1a`,
      }}
      title={open ? 'Hide example manifest' : 'Show a minimal example manifest'}
    >
      <svg className="manifest-chip-icon" width="10" height="10" viewBox="0 0 16 16" fill="none"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 1.7h5L12.5 5.2V14a.3.3 0 0 1-.3.3H4a.3.3 0 0 1-.3-.3V2a.3.3 0 0 1 .3-.3Z" />
        <path d="M9 1.7V5.2h3.5" />
      </svg>
      {kind}
    </button>
  )
}

// The revealed manifest body: a copy-able code block, styled like the shell
// command blocks but tagged yaml / systemd unit.
export function ManifestBlock({ body, kind = 'MANIFEST', color }) {
  const [copied, setCopied] = useState(false)
  const lang = kind === 'UNIT' ? 'systemd unit' : 'yaml'
  const copy = (e) => {
    e.stopPropagation()
    copyToClipboard(body)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })
      .catch(() => {})
  }
  return (
    <div className="manifest-block">
      <div className="manifest-block-head">
        <span className="manifest-block-lang">{lang} · minimal example</span>
        <button
          type="button"
          onClick={copy}
          className="manifest-block-copy"
          style={{
            color: copied ? 'var(--bg)' : 'var(--tx-muted)',
            background: copied ? color : 'transparent',
            borderColor: copied ? color : 'var(--border-w)',
          }}
        >
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>
      <pre className="code-block manifest-code">{body}</pre>
    </div>
  )
}
