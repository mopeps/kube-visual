import { useCallback, useEffect, useRef, useState } from 'react'

// Drives the systemd "state reconciliation loop" animation on the Deep Dive
// canvas. A timed phase machine walks the failure→recovery cycle and hands back
// per-box overlays (a live status subtitle, an accent, a pulse flag) plus a
// travelling "courier" chip (SIGCHLD up to the engine, then fork()/execve()
// down to the cgroup). The boxes themselves stay plain NodeCards — this only
// supplies what changes.
//
//   idle → killed → sigchld(up) → failed → restart(down) → active → idle(newPid)
//
const GREEN = 'var(--k-green)'
const RED = 'var(--packet)'

// phase → how long to hold it (ms) before advancing. idle has no timer.
const NEXT = {
  killed: ['sigchld', 520],
  sigchld: ['failed', 820],
  failed: ['restart', 760],
  restart: ['active', 900],
  active: ['idle', 760],
}

export default function useReconciliationLoop(recon) {
  const [phase, setPhase] = useState('idle')
  const [pid, setPid] = useState(recon?.mainPid ?? null)
  const timer = useRef(null)

  const clear = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
  }, [])

  // Advance through the scripted phases. The PID flips to the restart PID at the
  // moment the engine re-execs (entering "active").
  useEffect(() => {
    if (!recon || phase === 'idle') return
    if (phase === 'active') setPid(recon.restartPid)
    const step = NEXT[phase]
    if (!step) return
    timer.current = setTimeout(() => setPhase(step[0]), step[1])
    return clear
  }, [phase, recon, clear])

  useEffect(() => clear, [clear])

  const kill = useCallback(() => {
    if (!recon) return
    clear()
    setPid(recon.mainPid)
    setPhase('killed')
  }, [recon, clear])

  const reset = useCallback(() => {
    clear()
    setPid(recon?.mainPid ?? null)
    setPhase('idle')
  }, [recon, clear])

  if (!recon) {
    return { phase: 'idle', running: false, pid: null, overlays: {}, courier: null, kill: () => {}, reset: () => {} }
  }

  const failed = phase === 'failed' || phase === 'restart'
  const dead = phase === 'killed' || phase === 'sigchld' || failed

  const overlays = {
    [recon.dagBoxId]: {
      subtitle: `${recon.unit} — ${failed ? 'UNIT_FAILED' : 'UNIT_ACTIVE'}`,
      accent: failed ? RED : GREEN,
      highlight: phase === 'failed',
    },
    [recon.engineBoxId]: {
      subtitle: phase === 'sigchld' || phase === 'failed'
        ? 'woken by signalfd — SIGCHLD'
        : phase === 'restart'
          ? 'fork() / execve() — restarting'
          : 'blocked on signalfd…',
      highlight: phase === 'sigchld' || phase === 'restart',
    },
    [recon.cgroupBoxId]: {
      subtitle: dead && phase !== 'active'
        ? `cgroup.procs → ∅  (helper ${recon.childPid} trapped)`
        : `cgroup.procs → ${pid}  (+ helper ${recon.childPid})`,
      accent: phase === 'restart' || phase === 'active' ? GREEN : undefined,
      highlight: phase === 'restart',
    },
    [recon.realityBoxId]: {
      subtitle: phase === 'killed'
        ? `PID ${recon.mainPid} ✗ killed — SIGCHLD fired`
        : dead
          ? `PID ${recon.mainPid} dead — children trapped in cgroup`
          : `PID ${pid} running`,
      accent: phase === 'killed' ? RED : undefined,
      highlight: phase === 'killed',
    },
  }

  const courier =
    phase === 'sigchld'
      ? { active: true, dir: 'up', label: '⚡ SIGCHLD' }
      : phase === 'restart'
        ? { active: true, dir: 'down', label: 'fork() / execve()' }
        : null

  return { phase, running: phase !== 'idle', pid, overlays, courier, kill, reset }
}
