import { useState } from 'react'

// Copy text to the clipboard, tolerating insecure contexts / denied permissions
// where navigator.clipboard is unavailable or writeText rejects.
export function copyToClipboard(text) {
  if (!navigator.clipboard?.writeText) return Promise.reject(new Error('clipboard unavailable'))
  return navigator.clipboard.writeText(text)
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.4" />
      <path d="M10.5 5.5V3.4A1.4 1.4 0 0 0 9.1 2H3.4A1.4 1.4 0 0 0 2 3.4v5.7A1.4 1.4 0 0 0 3.4 10.5h2.1" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  )
}

// A command, the way the data ships it: a leading `# …` caption line that says
// what the command is for, then the command itself. Split the two so the caption
// reads as prose and the command reads as something you'd type at a prompt.
function splitCommand(cmd) {
  const lines = cmd.split('\n')
  const note = lines.filter(l => /^\s*#/.test(l)).map(l => l.replace(/^\s*#\s?/, '')).join(' ')
  const code = lines.filter(l => l.trim() && !/^\s*#/.test(l))
  return { note, code: code.length ? code : lines }
}

// A stack of copy-able shell commands rendered as a single terminal-prompt
// pane: an accent spine ties it to the component colour, each row pairs a dim
// caption with its `$`-prompted command, and the copy lifts only the runnable
// lines (not the caption). Shared by the detail sections, the pipeline tree's
// command-bearing entries, and the deep-dive sections.
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
    <div className="cmd-stack" style={{ '--cmd-accent': color }}>
      {commands.map((cmd, i) => {
        const { note, code } = splitCommand(cmd)
        const copied = copiedIndex === i
        return (
          <div key={i} className="cmd-row">
            {note && <div className="cmd-note">{note}</div>}
            <div className="cmd-line">
              <code className="cmd-code">
                {code.map((line, j) => (
                  <span key={j} className="cmd-code-line">
                    <span className="cmd-prompt" aria-hidden="true">$</span>
                    {line}
                  </span>
                ))}
              </code>
              <button
                type="button"
                onClick={() => copy(code.join('\n'), i)}
                className={`cmd-copy${copied ? ' is-copied' : ''}`}
                aria-label={copied ? 'Copied' : 'Copy command'}
                title={copied ? 'Copied' : 'Copy command'}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
