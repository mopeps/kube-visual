import Zone from './Zone'
import NodeCard from './NodeCard'
import useReconciliationLoop from '../hooks/useReconciliationLoop'

// Renders a deep-dive topic as an Overview-style canvas: a stack of labelled
// zones holding clickable boxes. Reuses Zone / NodeCard (pure presentational),
// with a custom onClick that opens the deep-dive popup instead of the node
// modal. When the topic declares `reconciliation`, it also drives the animated
// systemd loop — merging live status overlays onto the named boxes and showing
// a control bar + a travelling signal courier.

const accentOf = (zone, topic) => `var(--${zone.colorVar || topic.colorVar || 'k-cyan'})`

export default function DeepDiveCanvas({ topic, onSelectBox }) {
  const loop = useReconciliationLoop(topic.reconciliation)
  const overlays = loop.overlays

  const renderBox = (box, zone) => {
    const ov = overlays[box.id]
    return (
      <NodeCard
        key={box.id}
        id={`dd-${box.id}`}
        title={box.title}
        typePrefix={box.typePrefix}
        color={ov?.accent || accentOf(zone, topic)}
        subtitle={ov?.subtitle ?? box.subtitle}
        badges={box.badges}
        isHighlighted={ov?.highlight}
        onClick={() => onSelectBox(box.id)}
      />
    )
  }

  const renderZone = (zone, depth = 0) => (
    <Zone
      key={zone.id}
      label={zone.label}
      color={accentOf(zone, topic)}
      dashed={zone.dashed}
      depth={depth}
    >
      {zone.boxes?.map((box) => renderBox(box, zone))}
      {zone.zones?.map((child) => renderZone(child, depth + 1))}
    </Zone>
  )

  return (
    <div className="deep-dive-canvas">
      {topic.reconciliation && (
        <div className="recon-controls" data-noswipe>
          <span className="recon-controls-label">Reconciliation loop</span>
          <button
            type="button"
            className="recon-btn recon-btn--kill"
            onClick={loop.kill}
            disabled={loop.running}
          >
            ⚡ Kill Main PID {topic.reconciliation.mainPid}
          </button>
          <button
            type="button"
            className="recon-btn"
            onClick={loop.reset}
            disabled={!loop.running && loop.pid === topic.reconciliation.mainPid}
          >
            ↺ Reset
          </button>
          <span className="recon-phase">{phaseLabel(loop.phase)}</span>
        </div>
      )}

      <div className="overview-canvas recon-stack">
        {loop.courier?.active && (
          <div className={`recon-courier is-${loop.courier.dir}`} aria-hidden>
            {loop.courier.label}
          </div>
        )}
        {topic.zones.map((zone) => renderZone(zone))}
      </div>
    </div>
  )
}

function phaseLabel(phase) {
  switch (phase) {
    case 'killed': return 'main process killed'
    case 'sigchld': return 'kernel fired SIGCHLD ↑'
    case 'failed': return 'engine woke · UNIT_FAILED'
    case 'restart': return 'fork() / execve() ↓'
    case 'active': return 'restarted · UNIT_ACTIVE'
    default: return 'idle · UNIT_ACTIVE'
  }
}
