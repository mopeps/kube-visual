import { useState, useCallback, useMemo } from 'react'

export default function useEventState() {
  const [activeEvent, setActiveEvent] = useState(null)
  const [activeComponentId, setActiveComponentId] = useState(null)
  // Which hop (step number) is currently inspected via the bottom hop panel.
  const [activeStep, setActiveStep] = useState(null)
  // A component the overview should transiently spotlight (e.g. after the user
  // clicks the location badge in a detail popup to "find this on the canvas").
  // Independent of the trace-flow highlight; cleared automatically once shown.
  const [highlightedId, setHighlightedId] = useState(null)

  const selectEvent = useCallback((event) => {
    // Switching/clearing the trace always drops any inspected hop.
    setActiveStep(null)
    setActiveEvent(prev => prev?.eventId === event.eventId ? null : event)
  }, [])

  const clearEvent = useCallback(() => {
    setActiveStep(null)
    setActiveEvent(null)
  }, [])

  // Toggle a hop open/closed; selecting a different hop just swaps it.
  const selectStep = useCallback((step) => {
    setActiveStep(prev => prev === step ? null : step)
  }, [])

  // Unconditionally focus a hop (no toggle) — used when jumping in from the
  // event tab so the overview always lands on that hop rather than clearing it.
  const focusStep = useCallback((step) => setActiveStep(step), [])

  const clearStep = useCallback(() => setActiveStep(null), [])

  const selectComponent = useCallback((id) => {
    setActiveComponentId(prev => prev === id ? null : id)
  }, [])

  // Unconditionally open a component's detail sheet (no toggle) — used when
  // jumping in from search, where the result should always open, never close
  // an already-open sheet for the same id.
  const focusComponent = useCallback((id) => setActiveComponentId(id), [])

  const clearComponent = useCallback(() => setActiveComponentId(null), [])

  // Spotlight a component on the overview, then forget it (the overview clears
  // the highlight once it has scrolled to and pulsed the target).
  const revealComponent = useCallback((id) => setHighlightedId(id), [])
  const clearHighlight = useCallback(() => setHighlightedId(null), [])

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
    activeStep,
    highlightedId,
    selectEvent,
    clearEvent,
    selectComponent,
    focusComponent,
    clearComponent,
    revealComponent,
    clearHighlight,
    selectStep,
    focusStep,
    clearStep,
  }
}
