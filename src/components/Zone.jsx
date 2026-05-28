export default function Zone({ label, color, dashed = false, depth = 0, children }) {
  return (
    <div
      className={`zone ${dashed ? 'zone--dashed' : ''} ${depth > 0 ? 'zone--nested' : ''}`}
      style={{
        background: `${color}${depth === 0 ? '14' : '0e'}`,
        '--zone-depth': depth,
      }}
    >
      <div
        className="zone-label"
        style={{
          color,
          borderColor: `${color}55`,
          background: `${color}10`,
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
