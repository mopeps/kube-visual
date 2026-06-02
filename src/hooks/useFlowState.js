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
    // Re-selecting the active flow toggles the whole trace off.
    if (activeFlow?.flowId === flow.flowId) {
      setActiveFlow(null)
      setActiveFlowStep(null)
      return
    }
    // Selecting a flow drops you straight onto its first hop — so the arrows
    // light up and the hop reader pops, the way actively tracing an event does
    // on the Overview (rather than leaving a static, unengaged diagram).
    setActiveFlow(flow)
    setActiveFlowStep(flow.steps[0]?.step ?? null)
  }, [activeFlow])

  // Unconditionally engage a flow on its first hop (no toggle) — used to
  // auto-start the trace when a deep-dive topic opens.
  const focusFlow = useCallback((flow) => {
    setActiveFlow(flow)
    setActiveFlowStep(flow?.steps?.[0]?.step ?? null)
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
    focusFlow,
    clearFlow,
    selectFlowStep,
    focusFlowStep,
    clearFlowStep,
  }
}
