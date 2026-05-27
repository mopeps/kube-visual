import { useState, useCallback } from 'react'

export default function useEventState() {
  const [activeEvent, setActiveEvent] = useState(null)
  const [activeComponentId, setActiveComponentId] = useState(null)
  const [expandedPods, setExpandedPods] = useState(new Set())

  const selectEvent = useCallback((event) => {
    if (activeEvent?.eventId === event.eventId) {
      setActiveEvent(null)
      setExpandedPods(new Set())
      return
    }
    setActiveEvent(event)
    const podIds = new Set(['app-pod', 'router-pod'])
    setExpandedPods(podIds)
  }, [activeEvent])

  const clearEvent = useCallback(() => {
    setActiveEvent(null)
    setExpandedPods(new Set())
  }, [])

  const selectComponent = useCallback((id) => {
    setActiveComponentId(prev => prev === id ? null : id)
  }, [])

  const clearComponent = useCallback(() => {
    setActiveComponentId(null)
  }, [])

  const togglePod = useCallback((podId) => {
    setExpandedPods(prev => {
      const next = new Set(prev)
      if (next.has(podId)) next.delete(podId)
      else next.add(podId)
      return next
    })
  }, [])

  const activeComponentIds = activeEvent
    ? new Set(activeEvent.steps.flatMap(s => [s.sourceComponentId, s.targetComponentId]))
    : new Set()

  return {
    activeEvent,
    activeComponentId,
    expandedPods,
    activeComponentIds,
    selectEvent,
    clearEvent,
    selectComponent,
    clearComponent,
    togglePod,
  }
}
