export default function Tabs({ tabs, active, onSelect }) {
  const moveFocus = (nextIndex) => {
    const next = tabs[(nextIndex + tabs.length) % tabs.length]
    onSelect(next.id)
    requestAnimationFrame(() => document.getElementById(`tab-${next.id}`)?.focus())
  }

  return (
    <div className="tabs" role="tablist" aria-label="Primary views">
      {tabs.map((t, index) => (
        <button
          key={t.id}
          id={`tab-${t.id}`}
          role="tab"
          aria-selected={active === t.id}
          aria-controls={`panel-${t.id}`}
          tabIndex={active === t.id ? 0 : -1}
          className={`tab-btn ${active === t.id ? 'is-active' : ''}`}
          onClick={() => onSelect(t.id)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') {
              event.preventDefault()
              moveFocus(index + 1)
            } else if (event.key === 'ArrowLeft') {
              event.preventDefault()
              moveFocus(index - 1)
            } else if (event.key === 'Home') {
              event.preventDefault()
              moveFocus(0)
            } else if (event.key === 'End') {
              event.preventDefault()
              moveFocus(tabs.length - 1)
            }
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
