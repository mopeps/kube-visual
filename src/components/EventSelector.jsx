import { useState, useRef, useEffect } from 'react'
import events from '../data/events.json'

export default function EventSelector({ activeEvent, onSelectEvent, onClearEvent }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(e) {
    onSelectEvent(e)
    setOpen(false)
  }

  function handleClear() {
    onClearEvent()
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative mb-6" style={{ display: 'inline-block' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-3 px-4 py-2 rounded-lg border transition-all"
        style={{
          background: open ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.3)',
          borderColor: open ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
          color: 'var(--tx-muted)',
        }}
        aria-label="Toggle trace flow menu"
      >
        {/* Hamburger icon */}
        <span className="flex flex-col gap-[4px]" aria-hidden>
          <span
            className="block h-[2px] w-[16px] rounded-full transition-all origin-center"
            style={{
              background: 'currentColor',
              transform: open ? 'translateY(6px) rotate(45deg)' : 'none',
            }}
          />
          <span
            className="block h-[2px] w-[16px] rounded-full transition-all"
            style={{
              background: 'currentColor',
              opacity: open ? 0 : 1,
            }}
          />
          <span
            className="block h-[2px] w-[16px] rounded-full transition-all origin-center"
            style={{
              background: 'currentColor',
              transform: open ? 'translateY(-6px) rotate(-45deg)' : 'none',
            }}
          />
        </span>

        <span className="text-[0.66rem] uppercase tracking-[0.16em] font-semibold">
          Trace Flow
        </span>

        {activeEvent && (
          <span
            className="text-[0.64rem] px-2 py-0.5 rounded-full border font-medium"
            style={{
              color: 'var(--packet)',
              borderColor: 'rgba(255,77,109,0.4)',
              background: 'rgba(255,77,109,0.1)',
            }}
          >
            {activeEvent.eventName}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-2 rounded-xl border p-4 z-50"
          style={{
            background: 'var(--panel)',
            borderColor: 'rgba(255,255,255,0.12)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
            minWidth: 280,
          }}
        >
          <p className="text-[0.58rem] uppercase tracking-[0.18em] mb-3" style={{ color: 'var(--tx-dim)' }}>
            Select a trace flow
          </p>
          <div className="flex flex-col gap-2">
            {events.map(e => {
              const isActive = activeEvent?.eventId === e.eventId
              return (
                <button
                  key={e.eventId}
                  className={`event-pill justify-start w-full ${isActive ? 'is-active' : ''}`}
                  onClick={() => handleSelect(e)}
                  title={e.description}
                >
                  {isActive && <span className="packet-dot" style={{ background: 'var(--bg)' }} />}
                  <span>{e.eventName}</span>
                </button>
              )
            })}
            {activeEvent && (
              <button
                className="event-pill w-full justify-start mt-1"
                onClick={handleClear}
                style={{ color: 'var(--tx-muted)', borderColor: 'rgba(255,255,255,0.08)' }}
              >
                × Clear trace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
