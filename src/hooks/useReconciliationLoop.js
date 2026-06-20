import { useCallback, useEffect, useMemo, useState } from 'react'

// Drives the systemd "state reconciliation loop" on the Deep Dive canvas as a
// manual, step-through walkthrough — the user advances one event at a time and
// reads what happened before moving on, instead of timer-driven phases racing
// past. Each step carries plain-language narration, lights up one connector edge
// on the canvas, and (where a signal crosses a layer) sends a token travelling
// along that edge. An optional Play button auto-advances at a readable pace.
//
// Four scenarios the user picks from the Deep Dive "Scenario" dropdown (the kill
// ones can also be triggered by clicking a PID in the cgroup box):
//
//   • Kill the MONITOR (main PID) → the unit can't survive, so systemd recovers it:
//       steady → killed → SIGCHLD → UNIT_FAILED → sweep → fork/execve → ACTIVE
//   • Kill the WORKER → OVS's own monitor respawns it one level below systemd,
//     which never sees a unit failure:
//       steady → worker killed → monitor respawns (still UNIT_ACTIVE, no restart)
//   • Edit unit + daemon-reload → recompile the DAG without touching the process:
//       steady → file edited → daemon-reload → DAG updated (still UNIT_ACTIVE)
//   • systemctl stop → desired flips to inactive, so the same SIGCHLD ends in
//       a clean stop instead of a restart:
//       steady → SIGTERM → SIGCHLD → sweep → UNIT_INACTIVE (no restart)
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
    phase: 'killed', procs: 'mainDead', title: 'Monitor (main PID) killed', tag: 'process dies',
    narration:
      'You killed the monitor — the PID systemd tracks. The worker it forked is now orphaned, but the kernel does NOT kill it. It only keeps it trapped in the unit’s cgroup so it can’t escape. Left alone the orphan would keep running; whether it lives or dies is systemd’s decision, taken later — never the kernel’s.',
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
      'PID 1’s epoll loop wakes and reads the unit’s desired state (UNIT_ACTIVE) from the DAG. The main PID is dead, so desired ≠ actual — the engine marks the unit UNIT_FAILED and, because Restart=always, decides to recover. That decision is what triggers the cleanup next.',
  },
  {
    phase: 'sweep', procs: 'swept', title: 'Sweep children', tag: 'reconciling',
    edge: 'sweep', signal: 'kill cgroup',
    narration:
      'Only now — and only because systemd decided to recover — does the sweep happen, and systemd does it, never the kernel. With KillMode=control-group it reads the unit’s cgroup.procs (the kernel’s exact membership list) and signals every PID still in it (SIGTERM, then SIGKILL), so no orphaned child survives into the new generation. The kernel never sweeps on its own and never acts ahead of this decision.',
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
      'systemd holds the unit at UNIT_ACTIVE. The monitor (main PID) and the worker it forked both run inside the cgroup.',
  },
  {
    phase: 'child-killed', procs: 'childDead', title: 'Worker killed', tag: 'process dies',
    narration:
      'You killed the worker. Its parent is the monitor, not PID 1 — so the kernel delivers the SIGCHLD to ovs-vswitchd’s monitor, and systemd’s signalfd never fires. This death stays one level below the supervisor.',
  },
  {
    phase: 'child-reaped', procs: 'childReaped', title: 'Monitor respawns it · no restart', tag: 'UNIT_ACTIVE',
    narration:
      'The monitor reaps the worker and immediately forks a fresh one. The main PID (the monitor) never died, so desired still equals actual: the unit stays UNIT_ACTIVE and systemd does nothing — a dead worker is the daemon’s business, not the supervisor’s.',
  },
]

// Edit a unit file then `systemctl daemon-reload`: the running process is never
// touched — only the in-memory DAG is recompiled from the edited text on disk.
const RELOAD_STEPS = [
  {
    phase: 'idle', procs: 'initial', title: 'Steady state', tag: 'UNIT_ACTIVE',
    narration:
      'systemd holds the unit at UNIT_ACTIVE. The compiled DAG in memory matches the unit file on disk, and the main PID runs, pinned in the cgroup.',
  },
  {
    phase: 'edited', procs: 'initial', title: 'Unit file edited', tag: 'disk changed',
    narration:
      'You edit ovs-vswitchd.service on disk (say, bump RestartSec=). Nothing happens yet — systemd acts on the in-memory DAG, not the file, so the running unit is still on the old config.',
  },
  {
    phase: 'reload', procs: 'initial', title: 'systemctl daemon-reload', tag: 'recompiling',
    edge: 'compile', signal: 'daemon-reload',
    narration:
      'daemon-reload re-parses every unit file and recompiles the DAG in place. This is the one edge that turns flat on-disk text back into the in-memory structs the engine reasons over.',
  },
  {
    phase: 'reloaded', procs: 'initial', title: 'DAG updated', tag: 'UNIT_ACTIVE',
    narration:
      'The DAG now reflects the new file, but the already-running process keeps its old settings until the next restart. A reload updates desired state; it does not re-exec the daemon.',
  },
]

// `systemctl stop`: the engine flips desired state to inactive, so the very same
// SIGCHLD that triggers a restart on a crash instead ends in a clean stop.
const STOP_STEPS = [
  {
    phase: 'idle', procs: 'initial', title: 'Steady state', tag: 'UNIT_ACTIVE',
    narration:
      'systemd holds the unit at UNIT_ACTIVE — main PID running, desired == actual.',
  },
  {
    phase: 'stopping', procs: 'mainDead', title: 'systemctl stop → SIGTERM', tag: 'stopping',
    edge: 'enforce', signal: 'SIGTERM',
    narration:
      'You run systemctl stop. The engine flips desired state to inactive and sends SIGTERM to the main PID, asking it to exit cleanly. The children stay trapped in the cgroup.',
  },
  {
    phase: 'stop-sigchld', procs: 'mainDead', title: 'Process exits · SIGCHLD', tag: 'feedback',
    edge: 'notify', signal: '⚡ SIGCHLD',
    narration:
      'The process exits and the kernel fires SIGCHLD. The same feedback edge wakes the engine — but this time desired state already says inactive, so the death was intended.',
  },
  {
    phase: 'stop-sweep', procs: 'swept', title: 'Sweep cgroup', tag: 'reconciling',
    edge: 'sweep', signal: 'kill cgroup',
    narration:
      'systemd reads the unit’s cgroup.procs and kills every PID still listed (a kill() per PID, or one write to cgroup.kill), so no trapped child survives the stop.',
  },
  {
    phase: 'inactive', procs: 'empty', title: 'UNIT_INACTIVE', tag: 'reconciled',
    narration:
      'Desired is now inactive and actual is empty — they agree, so there is no restart. The unit rests at UNIT_INACTIVE: the same SIGCHLD as a crash, opposite outcome, because desired state changed.',
  },
]

// The scenarios the Deep Dive "Scenario" dropdown offers, in order. `steps` is
// the event sequence; `start` is the index the walkthrough lands on when armed
// (1 = the triggering action itself, skipping the shared steady-state frame).
// `lede` is the one-line "why this scenario teaches something" framing, shown
// as a persistent caption in the walkthrough navigator while stepping.
const SCENARIOS = [
  { id: 'main',   name: 'Kill the main PID',      meta: 'restart',  steps: MAIN_STEPS,   start: 1,
    lede: 'The main PID is what systemd tracks — its death is drift, so the unit restarts. Watch cgroup.procs empty out and repopulate with fresh PIDs.' },
  { id: 'child',  name: 'Kill the worker',        meta: 'respawned', steps: CHILD_STEPS, start: 1,
    lede: 'A worker’s death is not drift — its parent is OVS’s own monitor, not systemd, so the monitor respawns it and the main PID still matches desired state. No unit restart.' },
  { id: 'reload', name: 'Edit unit + daemon-reload', meta: 'recompile', steps: RELOAD_STEPS, start: 1,
    lede: 'Editing a unit file changes nothing by itself — daemon-reload recompiles desired state (the DAG) without touching the running process.' },
  { id: 'stop',   name: 'systemctl stop',         meta: 'inactive', steps: STOP_STEPS,   start: 1,
    lede: 'The same SIGCHLD as a crash, the opposite outcome: desired state now says inactive, so the death is intended and nothing restarts.' },
]

const scenarioById = (id) => SCENARIOS.find((s) => s.id === id) || null

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
  const [scenario, setScenario] = useState(null) // 'main' | 'child' | 'reload' | 'stop' | null
  const [index, setIndex] = useState(0)
  const [childPid, setChildPid] = useState(null)
  const [playing, setPlaying] = useState(false)

  const active = scenarioById(scenario)
  const steps = active?.steps || MAIN_STEPS
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

  // Arm any scenario by id (driven by the Scenario dropdown). The kill scenarios
  // need a target PID: main uses recon.main, child defaults to the first helper
  // (or an explicit pid when armed by clicking a PID in the cgroup box).
  const arm = useCallback((id, pid = null) => {
    if (!recon) return
    const sc = scenarioById(id)
    if (!sc) return
    setPlaying(false)
    setChildPid(id === 'child' ? (pid ?? recon.children[0]?.pid ?? null) : null)
    setScenario(id)
    setIndex(sc.start) // land on the triggering action, not the steady frame
  }, [recon])

  const killMain = useCallback(() => arm('main'), [arm])
  const killChild = useCallback((pid) => arm('child', pid), [arm])

  const togglePlay = useCallback(() => {
    if (!recon) return
    if (!armed) { arm('main'); setPlaying(true); return }
    if (atEnd) { setIndex(active?.start ?? 1); setPlaying(true); return } // replay from the action
    setPlaying((p) => !p)
  }, [recon, armed, atEnd, arm, active])

  // Auto-advance while playing; stop at the end.
  useEffect(() => {
    if (!playing || !armed) return
    if (index >= steps.length - 1) { setPlaying(false); return }
    const t = setTimeout(() => setIndex((i) => i + 1), PLAY_MS)
    return () => clearTimeout(t)
  }, [playing, armed, index, steps.length])

  // Switching deep-dive topics (recon identity changes, or drops to null on a
  // non-systemd topic) disarms any walkthrough in flight so a fresh topic never
  // inherits a stale armed scenario.
  useEffect(() => { reset() }, [recon, reset])

  if (!recon) {
    return {
      armed: false, scenario: null, scenarioName: null, lede: null, scenarios: SCENARIOS,
      steps: [], index: 0, step: null, phase: 'idle',
      procs: [], overlays: {}, activeEdgeId: null, signal: null, playing: false,
      canPrev: false, canNext: false, atEnd: false,
      next: () => {}, prev: () => {}, goTo: () => {}, reset: () => {}, arm: () => {},
      killMain: () => {}, killChild: () => {}, togglePlay: () => {},
    }
  }

  const phase = step.phase
  const target = childPid
  const failed = phase === 'failed' || phase === 'sweep' || phase === 'restart'
  const mainDead = phase === 'killed' || phase === 'sigchld' || failed
  const childPath = phase === 'child-killed' || phase === 'child-reaped'
  const stopping = phase === 'stopping' || phase === 'stop-sigchld' || phase === 'stop-sweep'
  const inactive = phase === 'inactive'
  const reloading = phase === 'reload'
  const liveMainPid = procs.find((p) => p.role === 'main' && p.state === 'running')?.pid ?? recon.main.pid

  // Desired-state (DAG) pillar — the one place that reads UNIT_ACTIVE / FAILED /
  // INACTIVE, plus the transient "recompiling" / "deactivating" states.
  const dagState =
    failed ? 'UNIT_FAILED'
    : inactive ? 'UNIT_INACTIVE'
    : stopping ? 'deactivating'
    : reloading ? 'recompiling — daemon-reload'
    : 'UNIT_ACTIVE'

  const overlays = {
    [recon.dagBoxId]: {
      subtitle: `${recon.unit} — ${dagState}`,
      // The green/amber/red here is LIVE STATUS (UNIT_ACTIVE / deactivating /
      // UNIT_FAILED), shown only while a scenario is armed. At rest the box wears
      // its own zone colour (amber, the systemd · PID 1 zone) so the green never
      // reads as kernel-zone membership.
      accent: !armed ? undefined : failed ? RED : inactive ? undefined : stopping ? 'var(--k-amber)' : GREEN,
      highlight: phase === 'failed' || phase === 'reload' || phase === 'inactive',
    },
    [recon.engineBoxId]: {
      subtitle:
        phase === 'sigchld' || phase === 'failed' ? 'woken by signalfd — SIGCHLD (main)'
        : phase === 'sweep' ? 'sweeping cgroup — reaping trapped children'
        : phase === 'restart' ? 'fork() / execve() — restarting'
        : phase === 'stopping' ? 'desired → inactive — sending SIGTERM'
        : phase === 'stop-sigchld' ? 'woken by signalfd — SIGCHLD (stop)'
        : phase === 'stop-sweep' ? 'sweeping cgroup — clean stop'
        : phase === 'reload' ? 'daemon-reload — recompiling the DAG'
        : childPath ? 'idle — a worker death never reaches systemd'
        : 'blocked on signalfd…',
      highlight:
        phase === 'sigchld' || phase === 'restart' || phase === 'failed'
        || phase === 'reload' || stopping,
    },
    [recon.cgroupBoxId]: {
      subtitle: `system.slice/${recon.unit}`,
      accent: armed && (phase === 'restart' || phase === 'active') ? GREEN : undefined,
      highlight: phase === 'sweep' || phase === 'restart' || phase === 'stop-sweep',
    },
    [recon.realityBoxId]: {
      subtitle:
        phase === 'killed' ? `PID ${recon.main.pid} ✗ killed — SIGCHLD fired`
        : phase === 'stopping' ? `PID ${recon.main.pid} ← SIGTERM — exiting`
        : phase === 'stop-sigchld' ? 'main exited cleanly — children trapped'
        : phase === 'stop-sweep' ? 'swept — cgroup emptying'
        : inactive ? 'no processes — unit inactive'
        : mainDead ? 'main dead — children trapped in cgroup'
        : childPath ? `worker ${target} died — monitor respawned it, main alive`
        : `PID ${liveMainPid} running`,
      accent: armed && (phase === 'killed' || phase === 'child-killed' || phase === 'stopping') ? RED : undefined,
      highlight:
        phase === 'killed' || phase === 'sigchld' || phase === 'child-killed'
        || phase === 'stopping' || phase === 'stop-sigchld',
    },
  }

  // The travelling signal token — keyed by index so it replays each step.
  const signal = step.signal && step.edge
    ? { edgeId: step.edge, label: step.signal, key: `${scenario}-${index}` }
    : null

  return {
    armed,
    scenario,
    scenarioName: active?.name || null,
    lede: active?.lede || null,
    scenarios: SCENARIOS,
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
    arm,
    killMain,
    killChild,
    togglePlay,
  }
}
