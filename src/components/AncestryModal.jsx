import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import componentsData from '../data/components.json'
import { COMPONENT_COLOR, COMPONENT_ZONE } from '../data/zones'
import { PIPELINE_LAYER_BY_ID, pipelineLayerColor } from '../data/pipeline-layers'
import PipelineTree from './PipelineTree'
import DetailSections from './DetailSections'

// How far (px) the sheet must be dragged down by touch before it dismisses.
const DRAG_DISMISS_PX = 110

export default function AncestryModal({ componentId, onClose }) {
  // Distance the modal is currently pushed down by a touch drag.
  const [offset, setOffset] = useState(0)
  // While true the modal animates (snapping back / sliding off); while false it
  // tracks the gesture 1:1 with no transition.
  const [snapping, setSnapping] = useState(false)
  const modalRef = useRef(null)
  const dragStartY = useRef(null)

  // Esc to close + reset drag state whenever a new component opens.
  useEffect(() => {
    if (!componentId) return
    setOffset(0)
    setSnapping(false)
    dragStartY.current = null
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [componentId, onClose])

  // Lock the page behind the modal so it can't scroll while open. Pins <body>
  // at its current scroll position and restores it on close so the page doesn't
  // jump. Idempotent restore-from-`prev` keeps StrictMode double-mount safe.
  useEffect(() => {
    if (!componentId) return
    const scrollY = window.scrollY
    const body = document.body
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    }
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    return () => {
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.width = prev.width
      body.style.overflow = prev.overflow
      window.scrollTo(0, scrollY)
    }
  }, [componentId])

  // Touch-drag to dismiss: swiping the modal down past the threshold closes it.
  // Only engages when the modal's own content is scrolled to the top so it
  // doesn't fight internal scrolling.
  const onTouchStart = (e) => {
    if (modalRef.current && modalRef.current.scrollTop > 0) return
    dragStartY.current = e.touches[0].clientY
    setSnapping(false)
  }
  const onTouchMove = (e) => {
    if (dragStartY.current == null) return
    const dy = e.touches[0].clientY - dragStartY.current
    setOffset(dy > 0 ? dy : 0)
  }
  const onTouchEnd = () => {
    if (dragStartY.current == null) return
    const dragged = offset
    dragStartY.current = null
    setSnapping(true)
    if (dragged >= DRAG_DISMISS_PX) onClose()
    else setOffset(0)
  }

  if (!componentId) return null

  const component = componentsData.find(c => c.componentId === componentId)
  if (!component) return null

  const color = COMPONENT_COLOR[componentId] || 'var(--k-cyan)'
  const zone = COMPONENT_ZONE[componentId]
  const layer = PIPELINE_LAYER_BY_ID[component.pipelineLayer]
  const layerColor = pipelineLayerColor(component.pipelineLayer)

  const hasTree = !!(component.ancestry || component.consumedResources?.length || component.kernelRealization)

  return createPortal(
    <div
      className="ancestry-overlay animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={modalRef}
        className="ancestry-modal"
        role="dialog"
        aria-modal="true"
        aria-label={component.displayName}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={
          offset > 0 || snapping
            ? {
                transform: `translateY(${offset}px)`,
                transition: snapping ? 'transform 0.3s ease' : 'none',
              }
            : undefined
        }
      >
        <div className="ancestry-drag-handle" />
        <button className="detail-close" onClick={onClose} aria-label="Close (Esc)">✕</button>

        <div className="detail-title" style={{ color }}>
          {component.typePrefix && (
            <span className="detail-type-prefix">[{component.typePrefix}]&nbsp;</span>
          )}
          {component.displayName}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 22 }}>
          {layer && (
            <span
              className="pipeline-layer-chip"
              style={{ color: layerColor, borderColor: layerColor, background: `${layerColor}1a` }}
              title={layer.blurb}
            >
              {layer.icon} {layer.label}
            </span>
          )}
          <span className="detail-type" style={{ color, marginBottom: 0 }}>
            {zone?.label || component.layer}
          </span>
        </div>

        {hasTree && (
          <div className="detail-section">
            <h4>Manifest → Kernel Pipeline</h4>
            <PipelineTree component={component} />
          </div>
        )}

        <DetailSections
          component={component}
          color={color}
          suppressLegacyPrimitives={!!component.kernelRealization}
        />

        <div
          className="text-[0.6rem] mt-6 pt-4 border-t"
          style={{ color: 'var(--tx-dim)', borderColor: 'var(--border-d)' }}
        >
          Press <span style={{ color: 'var(--tx-muted)' }}>Esc</span> or tap outside to close · id:&nbsp;
          <span style={{ color: 'var(--tx-muted)' }}>{component.componentId}</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
