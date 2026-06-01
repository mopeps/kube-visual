import { useState } from 'react'
import { copyToClipboard } from './ExploreCommands'

// The clickable tag that opens an object's minimal example manifest. It is
// styled to be visually identical to the detail-modal concept badges
// (.node-badge--concept) — same size, fill-on-open, and hover — so it reads as
// one of the same family of tags wherever it appears (the detail badge row and,
// inside a pipeline node's expanded detail).
//   kind: 'MANIFEST' → a Kubernetes YAML object
//         'UNIT'     → a systemd unit file (host services have no K8s manifest)
export function ManifestChip({ open, onToggle, kind = 'MANIFEST', color }) {
  return (
    <button
      type="button"
      className="node-badge node-badge--concept"
      aria-expanded={open}
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      style={{
        color: open ? 'var(--bg)' : color,
        borderColor: open ? color : `${color}66`,
        background: open ? color : `${color}1a`,
        fontSize: '0.62rem',
        padding: '4px 10px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background 0.15s, color 0.15s',
      }}
      onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = `${color}35` }}
      onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = `${color}1a` }}
      title={open ? 'Hide example manifest' : 'Show a minimal example manifest'}
    >
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
