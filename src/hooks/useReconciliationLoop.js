import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Drives the systemd "state reconciliation loop" on the Deep Dive canvas as a
// manual, step-through walkthrough — the user advances one event at a time and
// reads what happened before moving on, instead of timer-driven phases racing
// past. Each step carries plain-language narration, lights up one connector edge
// on the canvas, and (where a signal crosses a layer) sends a token travelling
// along that edge. An optional Play button auto-advances at a readable pace.
//
// Two scenarios the user can trigger by clicking a PID in the cgroup box (or the
// control bar):
//
//   • Kill the MAIN PID → the unit can't survive, so systemd recovers it:
//       steady → killed → SIGCHLD → UNIT_FAILED → sweep → fork/execve → ACTIVE
//   • Kill a CHILD PID → systemd just reaps it; the main process lives on:
//       steady → child killed → reaped (still UNIT_ACTIVE, no restart)
//
// It hands back the live process list, the ordered step list (for the timeline),
// the current step's narration + active edge + travelling signal, per-box status
// overlays, and the step controls.

const GREEN = 'var(--k-green)'
const RED = 'var(--packet)'
const PLAY_MS = 2100 // readable auto-advance cadence

// ── The event sequences ──────────────────────────────────────────────────────
// `procs` is a tag the live process set is derived from (see procsForStep).
// `edge` is the connector-edge id this step lights; `signal` (when set) travels
// along that edge as a labelled token.
const MAIN_STEPS = [
  {
    phase: 'idle', procs: 'initial', title: 'Steady state', tag: 'UNIT_ACTIVE',
    narration:
      'systemd holds the unit at UNIT_ACTIVE. Desired state (the DAG) and actual state (the cgroup) agree — the main PID and its children all run, pinned by the kernel.',
  },
  {
    phase: 'killed', procs: 'mainDead', title: 'Main PID killed', tag: 'process dies',
    narration:
      'You killed the main PID. It dies on the CPU. Its children are now orphaned, but the kernel keeps them trapped inside the unit’s cgroup — they cannot escape.',
  },
  {
    phase: 'sigchld', procs: 'mainDead', title: 'Kernel fires SIGCHLD', tag: 'feedback',
    edge: 'notify', signal: '⚡ SIGCHLD',
    narration:
      'The kernel turns the death into a SIGCHLD signal and writes it to systemd’s signalfd. systemd never polls — this is the feedback edge that wakes PID 1 the instant a process dies.',
  },
  {
    phase: 'failed', procs: 'mainDead', title: 'UNIT_FAILED', tag: 'drift detected',
    edge: 'evaluate',
    narration:
      'PID 1’s epoll loop wakes, matches the dead PID to its unit, and flips the DAG node to UNIT_FAILED. Desired ≠ actual: systemd has detected drift.',
  },
  {
    phase: 'sweep', procs: 'swept', title: 'Sweep children', tag: 'reconciling',
    edge: 'pin',
    narration:
      'The restart policy says recover. systemd sweeps the trapped children out of the cgroup first, so no stale process survives into the new generation.',
  },
  {
    phase: 'restart', procs: 'empty', title: 'fork() / execve()', tag: 'enforcing',
    edge: 'enforce', signal: 'fork() / execve()',
    narration:
      'systemd re-runs ExecStart via direct fork() / execve() syscalls, launching a fresh process into a clean cgroup.',
  },
  {
    phase: 'active', procs: 'restarted', title: 'UNIT_ACTIVE', tag: 'reconciled',
    narration:
      'The new PID is running and pinned in the cgroup. Desired == actual once more: the unit is UNIT_ACTIVE and the loop has closed.',
  },
]

const CHILD_STEPS = [
  {
    phase: 'idle', procs: 'initial', title: 'Steady state', tag: 'UNIT_ACTIVE',
    narration:
      'systemd holds the unit at UNIT_ACTIVE. The main PID and its helper children all run inside the cgroup.',
  },
  {
    phase: 'child-killed', procs: 'childDead', title: 'Child PID killed', tag: 'process dies',
    edge: 'notify', signal: '⚡ SIGCHLD',
    narration:
      'You killed a child (helper) PID. It dies and the kernel fires a SIGCHLD for it too — the same feedback edge wakes systemd.',
  },
  {
    phase: 'child-reaped', procs: 'childReaped', title: 'Child reaped · no restart', tag: 'UNIT_ACTIVE',
    narration:
      'systemd reaps the child, but the main PID is still alive — so desired still equals actual. The unit stays UNIT_ACTIVE: a dead helper does not trigger a restart.',
  },
]

const buildProcs = (main, children) => [
  { ...main, role: 'main', state: 'running' },
  ...children.map((c) => ({ ...c, role: 'child', state: 'running' })),
]

// Derive the visible process list for a step from its `procs` tag.
function procsForStep(recon, tag, childPid) {
  const initial = buildProcs(recon.main, recon.children)
  switch (tag) {
    case 'mainDead':
      return initial.map((p) =>
        p.role === 'main' ? { ...p, state: 'dead' } : { ...p, state: 'trapped' })
    case 'swept':
      return initial.map((p) =>
        p.role === 'main' ? { ...p, state: 'dead' } : { ...p, state: 'swept' })
    case 'empty':
      return []
    case 'restarted':
      return buildProcs(recon.restart.main, recon.restart.children)
    case 'childDead':
      return initial.map((p) => (p.pid === childPid ? { ...p, state: 'dead' } : p))
    case 'childReaped':
      return initial.filter((p) => p.pid !== childPid)
    case 'initial':
    default:
      return initial
  }
}

export default function useReconciliationLoop(recon) {
  const [scenario, setScenario] = useState(null) // 'main' | 'child' | null
  const [index, setIndex] = useState(0)
  const [childPid, setChildPid] = useState(null)
  const [playing, setPlaying] = useState(false)

  const steps = scenario === 'child' ? CHILD_STEPS : MAIN_STEPS
  const armed = scenario !== null
  // Before a scenario is armed we sit on the steady-state frame.
  const step = armed ? steps[index] : MAIN_STEPS[0]

  const procs = useMemo(
    () => (recon ? procsForStep(recon, step.procs, childPid) : []),
    [recon, step.procs, childPid],
  )

  const canPrev = armed && index > 0
  const canNext = armed && index < steps.length - 1
  const atEnd = armed && index === steps.length - 1

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, steps.length - 1)), [steps.length])
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [])
  const goTo = useCallback((i) => { setPlaying(false); setIndex(i) }, [])

  const reset = useCallback(() => {
    setPlaying(false)
    setScenario(null)
    setChildPid(null)
    setIndex(0)
  }, [])

  const killMain = useCallback(() => {
    if (!recon) return
    setPlaying(false)
    setChildPid(null)
    setScenario('main')
    setIndex(1) // step 1 = the kill itself
  }, [recon])

  const killChild = useCallback((pid) => {
    if (!recon) return
    setPlaying(false)
    setChildPid(pid)
    setScenario('child')
    setIndex(1)
  }, [recon])

  const togglePlay = useCallback(() => {
    if (!recon) return
    if (!armed) { setChildPid(null); setScenario('main'); setIndex(1); setPlaying(true); return }
    if (atEnd) { setIndex(1); setPlaying(true); return } // replay from the kill
    setPlaying((p) => !p)
  }, [recon, armed, atEnd])

  // Auto-advance while playing; stop at the end.
  useEffect(() => {
    if (!playing || !armed) return
    if (index >= steps.length - 1) { setPlaying(false); return }
    const t = setTimeout(() => setIndex((i) => i + 1), PLAY_MS)
    return () => clearTimeout(t)
  }, [playing, armed, index, steps.length])

  if (!recon) {
    return {
      armed: false, scenario: null, steps: [], index: 0, step: null, phase: 'idle',
      procs: [], overlays: {}, activeEdgeId: null, signal: null, playing: false,
      canPrev: false, canNext: false, atEnd: false,
      next: () => {}, prev: () => {}, goTo: () => {}, reset: () => {},
      killMain: () => {}, killChild: () => {}, togglePlay: () => {},
    }
  }

  const phase = step.phase
  const target = childPid
  const failed = phase === 'failed' || phase === 'sweep' || phase === 'restart'
  const mainDead = phase === 'killed' || phase === 'sigchld' || failed
  const childPath = phase === 'child-killed' || phase === 'child-reaped'
  const liveMainPid = procs.find((p) => p.role === 'main' && p.state === 'running')?.pid ?? recon.main.pid

  const overlays = {
    [recon.dagBoxId]: {
      subtitle: `${recon.unit} — ${failed ? 'UNIT_FAILED' : 'UNIT_ACTIVE'}`,
      accent: failed ? RED : GREEN,
      highlight: phase === 'failed',
    },
    [recon.engineBoxId]: {
      subtitle:
        phase === 'sigchld' || phase === 'failed' ? 'woken by signalfd — SIGCHLD (main)'
        : phase === 'sweep' ? 'sweeping cgroup — reaping trapped children'
        : phase === 'restart' ? 'fork() / execve() — restarting'
        : childPath ? `reaped child ${target} — unit stays UNIT_ACTIVE`
        : 'blocked on signalfd…',
      highlight: phase === 'sigchld' || phase === 'restart' || phase === 'failed' || phase === 'child-killed',
    },
    [recon.cgroupBoxId]: {
      subtitle: 'system.slice/ovnkube-node.service',
      accent: phase === 'restart' || phase === 'active' ? GREEN : undefined,
      highlight: phase === 'sweep' || phase === 'restart',
    },
    [recon.realityBoxId]: {
      subtitle:
        phase === 'killed' ? `PID ${recon.main.pid} ✗ killed — SIGCHLD fired`
        : mainDead ? 'main dead — children trapped in cgroup'
        : childPath ? `child ${target} died — reaped, main alive`
        : `PID ${liveMainPid} running`,
      accent: phase === 'killed' || phase === 'child-killed' ? RED : undefined,
      highlight: phase === 'killed' || phase === 'sigchld' || phase === 'child-killed',
    },
  }

  // The travelling signal token — keyed by index so it replays each step.
  const signal = step.signal && step.edge
    ? { edgeId: step.edge, label: step.signal, key: `${scenario}-${index}` }
    : null

  return {
    armed,
    scenario,
    steps,
    index,
    step,
    phase,
    procs,
    overlays,
    activeEdgeId: step.edge || null,
    signal,
    playing,
    canPrev,
    canNext,
    atEnd,
    next,
    prev,
    goTo,
    reset,
    killMain,
    killChild,
    togglePlay,
  }
}
