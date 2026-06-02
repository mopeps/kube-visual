import { useState, useCallback, useMemo } from 'react'

// Deep-dive trace flows — the Overview's event state, reused for the in-depth
// pages. A topic can declare `flows` (numbered box→box hops, see deep-dives.js);
// this hook tracks which flow is being traced and which hop is inspected, exactly
// the way useEventState tracks the active event + active hop on the Overview.
export default function useFlowState() {
  const [activeFlow, setActiveFlow] = useState(null)
  // Which hop (step number) is currently inspected via the bottom hop panel.
  const [activeFlowStep, setActiveFlowStep] = useState(null)

  const selectFlow = useCallback((flow) => {
    // Switching/clearing the trace always drops any inspected hop.
    setActiveFlowStep(null)
    setActiveFlow(prev => prev?.flowId === flow.flowId ? null : flow)
  }, [])

  const clearFlow = useCallback(() => {
    setActiveFlowStep(null)
    setActiveFlow(null)
  }, [])

  // Toggle a hop open/closed; selecting a different hop just swaps it.
  const selectFlowStep = useCallback((step) => {
    setActiveFlowStep(prev => prev === step ? null : step)
  }, [])

  // Unconditionally focus a hop (no toggle).
  const focusFlowStep = useCallback((step) => setActiveFlowStep(step), [])
  const clearFlowStep = useCallback(() => setActiveFlowStep(null), [])

  const activeBoxIds = useMemo(
    () => activeFlow
      ? new Set(activeFlow.steps.flatMap(s => [s.sourceBoxId, s.targetBoxId]))
      : new Set(),
    [activeFlow],
  )

  return {
    activeFlow,
    activeFlowStep,
    activeBoxIds,
    selectFlow,
    clearFlow,
    selectFlowStep,
    focusFlowStep,
    clearFlowStep,
  }
}
