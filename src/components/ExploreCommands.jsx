import { useState } from 'react'

// Copy text to the clipboard, tolerating insecure contexts / denied permissions
// where navigator.clipboard is unavailable or writeText rejects.
export function copyToClipboard(text) {
  if (!navigator.clipboard?.writeText) return Promise.reject(new Error('clipboard unavailable'))
  return navigator.clipboard.writeText(text)
}

// A stacked list of copy-able shell command blocks. Shared by the detail
// sections and the pipeline tree's command-bearing entries.
export default function ExploreCommands({ commands, color }) {
  const [copiedIndex, setCopiedIndex] = useState(null)
  const copy = (text, i) => {
    copyToClipboard(text)
      .then(() => {
        setCopiedIndex(i)
        setTimeout(() => setCopiedIndex(null), 1800)
      })
      .catch(() => {})
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {commands.map((cmd, i) => (
        <div
          key={i}
          style={{
            border: '1px solid var(--border-w)',
            borderRadius: 6,
            background: 'rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-1.5"
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderBottom: '1px solid var(--border-d)',
            }}
          >
            <span
              className="text-[0.6rem] uppercase tracking-[0.14em]"
              style={{ color: 'var(--tx-muted)' }}
            >
              shell · {String(i + 1).padStart(2, '0')}
            </span>
            <button
              onClick={() => copy(cmd, i)}
              className="text-[0.62rem] px-2 py-0.5 rounded border transition-colors"
              style={{
                color: copiedIndex === i ? 'var(--bg)' : 'var(--tx-muted)',
                background: copiedIndex === i ? color : 'transparent',
                borderColor: copiedIndex === i ? color : 'var(--border-w)',
              }}
            >
              {copiedIndex === i ? '✓ copied' : 'copy'}
            </button>
          </div>
          <pre className="code-block" style={{ border: 'none', borderRadius: 0 }}>
            {cmd}
          </pre>
        </div>
      ))}
    </div>
  )
}
