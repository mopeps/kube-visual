export default function Zone({ label, color, dashed = false, depth = 0, children }) {
  const isTop = depth === 0

  return (
    <div
      className={`zone ${dashed ? 'zone--dashed' : ''} ${depth > 0 ? 'zone--nested' : ''}`}
      style={{
        background: `${color}${isTop ? '18' : '12'}`,
        '--zone-depth': depth,
        '--zone-border': `${color}${dashed ? '60' : '45'}`,
        // top-level zones get a visible colored border + left accent stripe
        ...(isTop && {
          border: `1px solid ${color}40`,
          borderRadius: 12,
          borderLeft: `3px solid ${color}`,
        }),
      }}
    >
      <div
        className="zone-label"
        style={{
          color,
          borderColor: `${color}50`,
          background: `${color}14`,
          borderStyle: dashed ? 'dashed' : 'solid',
        }}
      >
        {label}
      </div>
      <div className="zone-content">
        <div className="zone-content-inner">
          {children}
        </div>
      </div>
    </div>
  )
}
