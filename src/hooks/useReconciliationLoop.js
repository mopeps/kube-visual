import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Drives the systemd "state reconciliation loop" animation on the Deep Dive
// canvas. The kernel pins a unit's processes inside its cgroup; this hook models
// that process set and the two failure paths the user can trigger by clicking a
// PID:
//
//   • main PID killed → SIGCHLD ↑ → UNIT_FAILED → systemd sweeps the trapped
//     children, then fork()/execve() ↓ restarts the unit with fresh PIDs.
//       idle → killed → sigchld → failed → sweep → restart → active → idle
//
//   • child PID killed → SIGCHLD ↑ → the engine reaps it; the *main* process is
//     still alive so the unit stays UNIT_ACTIVE — no restart.
//       idle → child-killed → child-reaped → idle
//
// It hands back the live process list (for the cgroup box), per-box overlays (a
// status subtitle / accent / pulse) and a travelling "courier" chip.

const GREEN = 'var(--k-green)'
const RED = 'var(--packet)'

const MAIN_NEXT = {
  killed: ['sigchld', 520],
  sigchld: ['failed', 820],
  failed: ['sweep', 760],
  sweep: ['restart', 640],
  restart: ['active', 900],
  active: ['idle', 760],
}
const CHILD_NEXT = {
  'child-killed': ['child-reaped', 560],
  'child-reaped': ['idle', 720],
}
const MAIN_PHASES = new Set(Object.keys(MAIN_NEXT))

const buildProcs = (main, children) => [
  { ...main, role: 'main', state: 'running' },
  ...children.map((c) => ({ ...c, role: 'child', state: 'running' })),
]

export default function useReconciliationLoop(recon) {
  const initial = useMemo(
    () => (recon ? buildProcs(recon.main, recon.children) : []),
    [recon],
  )

  const [phase, setPhase] = useState('idle')
  const [procs, setProcs] = useState(initial)
  const timer = useRef(null)
  const targetRef = useRef('main') // 'main' | <child pid>

  const clear = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
  }, [])

  // On entering each non-idle phase: mutate the process set, then schedule the
  // next phase. targetRef tells the child path which PID is in play.
  useEffect(() => {
    if (!recon || phase === 'idle') return
    switch (phase) {
      case 'killed':
        // main dies; the kernel keeps the children pinned (trapped).
        setProcs((ps) => ps.map((p) =>
          p.role === 'main' ? { ...p, state: 'dead' } : { ...p, state: 'trapped' }))
        break
      case 'sweep':
        setProcs((ps) => ps.map((p) => (p.state === 'trapped' ? { ...p, state: 'swept' } : p)))
        break
      case 'restart':
        setProcs([])
        break
      case 'active':
        setProcs(buildProcs(recon.restart.main, recon.restart.children))
        break
      case 'child-reaped':
        setProcs((ps) => ps.filter((p) => p.pid !== targetRef.current))
        break
      default:
        break
    }
    const step = (MAIN_PHASES.has(phase) ? MAIN_NEXT : CHILD_NEXT)[phase]
    if (!step) return
    timer.current = setTimeout(() => setPhase(step[0]), step[1])
    return clear
  }, [phase, recon, clear])

  useEffect(() => clear, [clear])

  const killMain = useCallback(() => {
    if (!recon) return
    clear()
    targetRef.current = 'main'
    setPhase('killed')
  }, [recon, clear])

  const killChild = useCallback((pid) => {
    if (!recon) return
    clear()
    targetRef.current = pid
    setProcs((ps) => ps.map((p) => (p.pid === pid ? { ...p, state: 'dead' } : p)))
    setPhase('child-killed')
  }, [recon, clear])

  const reset = useCallback(() => {
    clear()
    targetRef.current = 'main'
    setProcs(initial)
    setPhase('idle')
  }, [clear, initial])

  if (!recon) {
    return {
      phase: 'idle', running: false, procs: [], overlays: {}, courier: null,
      killMain: () => {}, killChild: () => {}, reset: () => {},
    }
  }

  const target = targetRef.current
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
      highlight: phase === 'sigchld' || phase === 'restart' || phase === 'child-killed',
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
      accent: phase === 'killed' ? RED : undefined,
      highlight: phase === 'killed',
    },
  }

  const courier =
    phase === 'sigchld' ? { active: true, dir: 'up', label: '⚡ SIGCHLD' }
    : phase === 'child-killed' ? { active: true, dir: 'up', label: '⚡ SIGCHLD (child)' }
    : phase === 'restart' ? { active: true, dir: 'down', label: 'fork() / execve()' }
    : null

  return {
    phase,
    running: phase !== 'idle',
    procs,
    overlays,
    courier,
    killMain,
    killChild,
    reset,
  }
}
