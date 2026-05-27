import Xarrow from 'react-xarrows'

export default function ArrowOverlay({ activeEvent, expandedPods }) {
  if (!activeEvent) return null

  return (
    <>
      {activeEvent.steps.map(step => {
        const start = document.getElementById(step.sourceComponentId)
        const end = document.getElementById(step.targetComponentId)
        if (!start || !end) return null

        return (
          <Xarrow
            key={`${activeEvent.eventId}-step-${step.step}`}
            start={step.sourceComponentId}
            end={step.targetComponentId}
            color="#60a5fa"
            strokeWidth={2}
            headSize={6}
            path="smooth"
            curveness={0.4}
            labels={{
              middle: (
                <div className="bg-blue-700 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-lg">
                  {step.step}
                </div>
              ),
            }}
          />
        )
      })}
    </>
  )
}
