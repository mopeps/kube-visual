// A row of outbound links to the official documentation for a component.
// Rendered at the very bottom of the inspector, after the Explore commands.
// Each entry is { label, url }; label names the doc source (e.g. "Kubernetes",
// "OpenShift", "KubeVirt") so a component can carry several when more than one
// project documents it.

// Small north-east arrow that marks every chip as an external link.
function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3.5H4.5A1.5 1.5 0 0 0 3 5v6.5A1.5 1.5 0 0 0 4.5 13H11a1.5 1.5 0 0 0 1.5-1.5V10" />
      <path d="M9.5 3.5H13V7" />
      <path d="M13 3.5 7.5 9" />
    </svg>
  )
}

export default function DocLinks({ links, color }) {
  if (!links?.length) return null
  return (
    <div className="detail-section">
      <h4>Official Docs</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {links.map(({ label, url }) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="node-badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              color,
              borderColor: `${color}66`,
              background: `${color}1a`,
              fontSize: '0.75rem',
              padding: '4px 10px',
              textDecoration: 'none',
              fontFamily: 'inherit',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `${color}35` }}
            onMouseLeave={e => { e.currentTarget.style.background = `${color}1a` }}
          >
            {label}
            <ExternalIcon />
          </a>
        ))}
      </div>
    </div>
  )
}
