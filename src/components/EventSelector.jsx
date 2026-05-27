import events from '../data/events.json'

export default function EventSelector({ activeEvent, onSelectEvent, onClearEvent }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      <span className="text-[0.66rem] uppercase tracking-[0.16em] text-tx-muted mr-2">
        Trace flow:
      </span>
      {events.map(e => {
        const isActive = activeEvent?.eventId === e.eventId
        return (
          <button
            key={e.eventId}
            className={`event-pill ${isActive ? 'is-active' : ''}`}
            onClick={() => onSelectEvent(e)}
            title={e.description}
          >
            {isActive && <span className="packet-dot" style={{ background: 'var(--bg)' }} />}
            <span>{e.eventName}</span>
          </button>
        )
      })}
      {activeEvent && (
        <button
          className="event-pill"
          onClick={onClearEvent}
          style={{ color: 'var(--tx-muted)' }}
        >
          × Clear
        </button>
      )}
    </div>
  )
}
