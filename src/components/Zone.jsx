export default function Zone({ label, color, children }) {
  return (
    <div
      className="zone"
      style={{
        background: `${color}18`,
      }}
    >
      <div
        className="zone-label"
        style={{
          color,
          borderColor: `${color}55`,
          background: `${color}10`,
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
