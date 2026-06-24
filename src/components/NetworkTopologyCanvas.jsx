import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import ReconLoopOverlay from './ReconLoopOverlay'

const EMPTY = []

const kindLabel = {
  bus: 'L2 segment',
  iface: 'interface',
  bridge: 'bridge',
  switch: 'logical switch',
  router: 'router',
  pod: 'pod port',
}

function nodeKind(box) {
  if (box?.variant === 'ellipse') return 'router'
  if (box?.variant === 'bus') return 'bus'
  if (box?.variant === 'iface') return 'iface'
  if (box?.variant === 'bridge') return 'bridge'
  if (box?.variant === 'pod') return 'pod'
  if (box?.variant === 'switch') return 'switch'
  return 'object'
}

function TopologyNode({ idPrefix, box, accent, active, onPath, dimmed, compact = false, onSelectBox }) {
  if (!box) return null
  const kind = nodeKind(box)
  const title = box.title?.replace(/^LS /, '')
  return (
    <button
      id={`${idPrefix}-${box.id}`}
      type="button"
      className={`nt-node nt-node--${kind} ${compact ? 'nt-node--compact' : ''} ${active ? 'is-active' : ''} ${onPath ? 'is-on-path' : ''} ${dimmed ? 'is-dimmed' : ''}`}
      style={{ '--nt-accent': accent }}
      onClick={(e) => { e.stopPropagation(); onSelectBox(box.id) }}
      aria-label={`${kindLabel[kind] || box.typePrefix || 'topology object'} ${box.title}`}
    >
      {kind !== 'iface' && kind !== 'bridge' && (
        <span className="nt-node-kind">
          {kindLabel[kind] || box.typePrefix}
        </span>
      )}
      <span className="nt-node-title">{title}</span>
      {box.caption && kind === 'pod' && <span className="nt-node-fact">{box.caption}</span>}
      {box.badges?.length > 0 && (
        <span className="nt-node-badges">
          {box.badges.map((b) => <span key={b.label} className="nt-node-badge">{b.label}</span>)}
        </span>
      )}
    </button>
  )
}

function TopologyColumn({ column, boxIndex, idPrefix, flowIds, focusedIds, onSelectBox }) {
  const box = (id) => boxIndex[id]?.box
  const accent = (id) => boxIndex[id]?.accent || 'var(--k-cyan)'
  const state = (id) => ({
    active: focusedIds?.has(id),
    onPath: focusedIds && !focusedIds.has(id) && flowIds?.has(id),
    dimmed: focusedIds && !focusedIds.has(id) && !flowIds?.has(id),
  })
  return (
    <section className="nt-column">
      <div className="nt-column-label">
        <span className="nt-column-name">{column.title}</span>
        {column.badges?.length > 0 && (
          <span className="nt-column-badges">
            {column.badges.map((b) => <span key={b}>{b}</span>)}
          </span>
        )}
      </div>

      <div className="nt-column-chain nt-column-chain--north">
        {column.north.map((id) => (
          <TopologyNode
            key={id}
            idPrefix={idPrefix}
            box={box(id)}
            accent={accent(id)}
            compact={id.includes('eth0') || id.includes('brint')}
            onSelectBox={onSelectBox}
            {...state(id)}
          />
        ))}
      </div>

      <div className="nt-column-gap" aria-hidden />

      <div className="nt-column-chain nt-column-chain--south">
        {column.south.map((entry) => (
          Array.isArray(entry) ? (
            <div key={entry.join('-')} className="nt-pod-row">
              {entry.map((id) => (
                <TopologyNode
                  key={id}
                  idPrefix={idPrefix}
                  box={box(id)}
                  accent={accent(id)}
                  compact
                  onSelectBox={onSelectBox}
                  {...state(id)}
                />
              ))}
            </div>
          ) : (
            <TopologyNode
              key={entry}
              idPrefix={idPrefix}
              box={box(entry)}
              accent={accent(entry)}
              compact={entry.includes('launcher')}
              onSelectBox={onSelectBox}
              {...state(entry)}
            />
          )
        ))}
      </div>
    </section>
  )
}

function TopologyPlane({ plane, boxIndex, idPrefix, flowIds, focusedIds, onSelectBox }) {
  const box = (id) => boxIndex[id]?.box
  const accent = (id) => boxIndex[id]?.accent || 'var(--k-cyan)'
  const state = (id) => ({
    active: focusedIds?.has(id),
    onPath: focusedIds && !focusedIds.has(id) && flowIds?.has(id),
    dimmed: focusedIds && !focusedIds.has(id) && !flowIds?.has(id),
  })
  return (
    <section className={`nt-plane nt-plane--${plane.id}`} style={{ '--nt-plane-accent': `var(--${plane.accentVar || 'k-cyan'})` }}>
      <div className="nt-plane-label">
        <span>{plane.title}</span>
        {plane.badges?.map((b) => <span key={b} className="nt-plane-badge">{b}</span>)}
      </div>

      {plane.underlay && (
        <div className="nt-underlay-row">
          <TopologyNode
            idPrefix={idPrefix}
            box={box(plane.underlay)}
            accent={accent(plane.underlay)}
            onSelectBox={onSelectBox}
            {...state(plane.underlay)}
          />
        </div>
      )}

      <div className="nt-plane-grid">
        <TopologyColumn
          column={plane.columns[0]}
          boxIndex={boxIndex}
          idPrefix={idPrefix}
          flowIds={flowIds}
          focusedIds={focusedIds}
          onSelectBox={onSelectBox}
        />

        <section className="nt-core">
          {plane.core.map((id) => (
            <TopologyNode
              key={id}
              idPrefix={idPrefix}
              box={box(id)}
              accent={accent(id)}
              onSelectBox={onSelectBox}
              {...state(id)}
            />
          ))}
        </section>

        <TopologyColumn
          column={plane.columns[1]}
          boxIndex={boxIndex}
          idPrefix={idPrefix}
          flowIds={flowIds}
          focusedIds={focusedIds}
          onSelectBox={onSelectBox}
        />
      </div>
    </section>
  )
}

export default function NetworkTopologyCanvas({
  topic,
  boxIndex,
  activeFlow,
  activeFlowStep,
  onSelectBox,
  onSelectEdge,
  idPrefix = 'dd',
}) {
  const shellRef = useRef(null)
  const canvasRef = useRef(null)
  const [fit, setFit] = useState({ scale: 1, width: null, height: null, mobile: false })
  const focusedStep = activeFlow && activeFlowStep != null
    ? activeFlow.steps.find((s) => s.step === activeFlowStep)
    : null
  const focusedIds = focusedStep ? new Set([focusedStep.sourceBoxId, focusedStep.targetBoxId]) : null
  const flowIds = useMemo(() => {
    if (!activeFlow) return null
    const ids = new Set()
    activeFlow.steps.forEach((s) => { ids.add(s.sourceBoxId); ids.add(s.targetBoxId) })
    return ids
  }, [activeFlow])
  const visibleIds = useMemo(() => new Set(topic.networkMap?.planes?.flatMap((plane) => [
    plane.underlay,
    ...plane.core,
    ...plane.columns.flatMap((col) => [
      ...col.north,
      ...col.south.flatMap((entry) => Array.isArray(entry) ? entry : [entry]),
    ]),
  ]).filter(Boolean) || EMPTY), [topic.networkMap])

  const edges = useMemo(() => {
    const all = topic.topology?.edges || EMPTY
    return all
      .filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to))
      .map((e) => {
        const active = focusedIds?.has(e.from) && focusedIds?.has(e.to)
        const onFlow = flowIds?.has(e.from) && flowIds?.has(e.to)
        return {
          ...e,
          showLabel: e.id?.startsWith('e-seam-') ? false : !!e.label,
          dim: !!activeFlow && !active && !onFlow,
          active,
        }
      })
  }, [topic.topology?.edges, visibleIds, focusedIds, flowIds, activeFlow])

  useLayoutEffect(() => {
    const shell = shellRef.current
    const canvas = canvasRef.current
    if (!shell || !canvas) return undefined

    let raf = 0
    const measure = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const mobile = window.matchMedia('(max-width: 640px)').matches
        if (!mobile) {
          setFit((prev) => (
            prev.scale === 1 && prev.width == null && prev.height == null && !prev.mobile
              ? prev
              : { scale: 1, width: null, height: null, mobile: false }
          ))
          return
        }

        const naturalWidth = canvas.scrollWidth || canvas.offsetWidth || 1
        const naturalHeight = canvas.scrollHeight || canvas.offsetHeight || 1
        const shellRect = shell.getBoundingClientRect()
        const availableWidth = Math.max(280, shell.clientWidth - 2)
        const availableHeight = Math.max(360, window.innerHeight - Math.max(0, shellRect.top) - 8)
        const nextScale = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight)
        const roundedScale = Math.max(0.1, Math.floor(nextScale * 1000) / 1000)
        const next = {
          scale: roundedScale,
          width: Math.ceil(naturalWidth * roundedScale),
          height: Math.ceil(naturalHeight * roundedScale),
          mobile: true,
        }
        setFit((prev) => (
          prev.scale === next.scale && prev.width === next.width && prev.height === next.height && prev.mobile
            ? prev
            : next
        ))
      })
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(shell)
    ro.observe(canvas)
    window.addEventListener('resize', measure, { passive: true })
    window.addEventListener('orientationchange', measure, { passive: true })
    return () => {
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
    }
  }, [topic.networkMap])

  if (!topic.networkMap) return null

  return (
    <div ref={shellRef} className={`deep-dive-canvas nt-shell ${fit.mobile ? 'is-fit-mobile' : ''}`}>
      <div
        className="nt-scroller"
        style={fit.mobile ? { width: `${fit.width}px`, height: `${fit.height}px` } : undefined}
      >
        <div
          ref={canvasRef}
          className={`network-topology-map network-topology-map--${topic.networkMap.id}`}
          data-fit-scale={fit.scale}
          style={fit.mobile ? { transform: `scale(${fit.scale})` } : undefined}
        >
          <ReconLoopOverlay
            edges={edges}
            canvasRef={canvasRef}
            activeEdgeId={null}
            signal={null}
            onSelectEdge={onSelectEdge}
            idPrefix={idPrefix}
            fitScale={fit.scale}
          />

          <div className="nt-map-title">
            <span>{topic.networkMap.title}</span>
            <small>{topic.networkMap.subtitle}</small>
          </div>

          {topic.networkMap.planes.map((plane, i) => (
            <div key={plane.id}>
              <TopologyPlane
                plane={plane}
                boxIndex={boxIndex}
                idPrefix={idPrefix}
                flowIds={flowIds}
                focusedIds={focusedIds}
                onSelectBox={onSelectBox}
              />
              {i === 0 && topic.networkMap.seams?.length > 0 && (
                <div className="nt-seam-legend">
                  {topic.networkMap.seams.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      id={`${idPrefix}-${s.id}`}
                      className="nt-seam-chip"
                      onClick={(e) => { e.stopPropagation(); onSelectEdge?.(s) }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
