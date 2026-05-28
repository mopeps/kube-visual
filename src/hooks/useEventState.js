import { useState, useCallback, useMemo } from 'react'

export default function useEventState() {
  const [activeEvent, setActiveEvent] = useState(null)
  const [activeComponentId, setActiveComponentId] = useState(null)

  const selectEvent = useCallback((event) => {
    setActiveEvent(prev => prev?.eventId === event.eventId ? null : event)
  }, [])

  const clearEvent = useCallback(() => setActiveEvent(null), [])

  const selectComponent = useCallback((id) => {
    setActiveComponentId(prev => prev === id ? null : id)
  }, [])

  const clearComponent = useCallback(() => setActiveComponentId(null), [])

  const activeComponentIds = useMemo(
    () => activeEvent
      ? new Set(activeEvent.steps.flatMap(s => [s.sourceComponentId, s.targetComponentId]))
      : new Set(),
    [activeEvent],
  )

  return {
    activeEvent,
    activeComponentId,
    activeComponentIds,
    selectEvent,
    clearEvent,
    selectComponent,
    clearComponent,
  }
}
