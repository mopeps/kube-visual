# tmux Window Naming Across `sudo -iu` — Architecture & Systems Reference

> Factual backbone for the **"tmux naming across `sudo -iu`"** deep dive
> (`src/data/deep-dives.js` → `TMUX_SUDO`). When the visual and this document
> disagree, this document is the intent: keep the pty nesting, the
> open-time-vs-use-time permission rule, and the escape-sequence grammar
> accurate.

A working solution for naming tmux windows by *effective user* (or kube cluster),
that survives switching identities with `sudo -iu`, plus a ground-up explanation
of *why* it works: file descriptors, ptys, escape sequences, and the control vs.
data path.

-----

## 1. The Goal

Window name should be:

```
if KUBE is set:      <cluster>          e.g. prod-cluster
else:                <effective-user>   e.g. bongo, root, oracle
```

No hostname. No command suffix (deliberately dropped — see §6).

## 2. The Problem

You start tmux as `bongo`, then switch identity inside panes:

```bash
sudo -iu root
sudo -iu oracle
```

You want the window name to reflect the *effective* user. But a sudo shell
**cannot reliably talk to tmux through tmux's normal control channel**, because
that channel (a Unix socket) is owned by the original user and lives behind a
`0700` directory. The other user is locked out of it.

The insight that solves this: **don't use tmux's control channel at all. Use the
data channel — the terminal byte stream — which every process in the pane owns
regardless of uid.**

-----

## 3. The Final Solution

### `~/.bashrc` — add to your shell, and to each user you `sudo -iu` into

```bash
# ---- tmux per-window naming ----
__tmux_name() {
    { [[ -n "$TMUX" ]] || [[ "$(ps -o comm= -p "$PPID" 2>/dev/null)" == *tmux* ]]; } || return
    local name
    if [[ -n "${KUBE_PS1_CLUSTER_NAME:-}" ]]; then
        name=$KUBE_PS1_CLUSTER_NAME
    else
        name=$(id -un 2>/dev/null)
    fi
    printf '\033k%s\033\\' "$name"
}
case $- in
*i*) PROMPT_COMMAND="__tmux_name${PROMPT_COMMAND:+;$PROMPT_COMMAND}" ;;
esac
# --------------------------------
```

### `~/.tmux.conf`

```tmux
set -g allow-rename on
set -g automatic-rename off
```

Reload without restarting:

```bash
tmux source-file ~/.tmux.conf
```

### Notes

- `allow-rename on` lets the escape sequence through; `automatic-rename off`
  stops tmux overwriting your name with `pane_current_command`. **Both are
  server-global** — they affect every window in the server.
- `sudo -iu oracle` is a *login* shell; it reads `~/.bash_profile`/`~/.profile`,
  which on most distros sources `~/.bashrc`. Confirm each target user's profile
  does so, or the block won't load.
- The `$PPID` check is the weak link **specifically for `sudo -iu`**, because the
  parent is `sudo`, not `tmux`. The robust fix is to preserve `$TMUX` across sudo:

  ```
  # sudo visudo -f /etc/sudoers.d/tmux
  Defaults env_keep += "TMUX TMUX_PANE"
  ```

  (Edit sudoers only with `visudo` — a syntax error can lock you out of sudo.)

-----

## 4. The Communication Chain (remote → local, over SSH)

```
oracle's bash
   │  writes bytes (incl. \033koracle\033\\) to fd 1
   ▼
/dev/pts/7  ── pty SLAVE  (remote host)
   │
   ▼
pty MASTER  ── held by tmux server  (remote host)
   │   tmux reads, CONSUMES the escape sequence, sets window name,
   │   then RENDERS its own screen image (status bar + panes)
   ▼
tmux writes that image to its own stdout
   │
   ▼
/dev/pts/3  ── a SECOND pty SLAVE  (the one sshd gave your login shell)
   │
   ▼
pty MASTER  ── held by sshd  (remote host)
   │   sshd encrypts the bytes into the TCP stream
   ▼
═══════════════  network (SSH, encrypted)  ═══════════════
   ▼
local ssh client  ── decrypts
   │
   ▼
local terminal emulator's parser  ── draws glyphs on your screen
```

**Two ptys nested on the remote host:** oracle's shell lives in tmux's pty;
tmux lives in sshd's pty. Each layer reads its child's pty, interprets what it
understands, and re-emits bytes upward.

-----

## 5. Key Insights into the Underlying Technologies

### 5.1 Escape sequences — control smuggled through content

- A terminal is a **byte stream**. Most bytes mean "draw this character." Some
  mean "here comes a command." The toggle is the `ESC` byte (`0x1B`, written
  `\033` or `\e`).
- There is **no separate control channel**. Control and content share one pipe;
  `ESC` is the door between *ground* state (printing text) and *command* state.
- Families: `ESC [` = **CSI** (cursor, color, clear — e.g. `ESC[31m` red);
  `ESC ]` = **OSC** (titles, clipboard, hyperlinks); short `ESC <byte>` forms.
- The one used here, `ESC k <name> ESC \`, is a **tmux/screen-specific** sequence:
  *"set this window's name to `<name>`."* `ESC k` opens the string; `ESC \` (ST,
  String Terminator) closes it — both delimiters are needed so the parser knows
  where the name ends.
- A terminal parser is a **finite state machine**: ground → escape → collecting →
  back to ground. Visible text is simply the machine sitting in ground state.
  This single idea explains the screen-garbage you see when a binary trips the
  parser into reading random bytes as commands.
- **Each layer parses the stream its child produced.** tmux's parser (remote)
  interprets oracle's `\033k...` and consumes it. Your local terminal's parser
  (laptop) interprets tmux's *rendered* output. sshd in between is not a parser —
  it's a dumb encrypted pipe.

### 5.2 The pty (pseudo-terminal) — local plumbing, not a network link

- A pty has **two ends**: the **slave** (`/dev/pts/N`) that a program opens as its
  terminal, and the **master** held by whatever pretends to be the terminal
  (tmux, sshd).
- **A pty never crosses the network.** It is entirely local to one host. What
  crosses the network is the SSH byte stream — nothing else.
- Bytes get *out* not by the pty travelling, but by a program **reading** the
  master end and **forwarding** the bytes onward. tmux and sshd are two such
  stacked forwarders.
- Your local terminal never sees `/dev/pts/7` or the raw `\033k...`. By the time
  anything reaches your laptop, tmux has already turned that sequence into
  "draw `oracle` in the status bar," expressed as *its own* escape sequences.
- Consequence: the rename completes **entirely remote-side**, in tmux's pty,
  *before* SSH is involved. Network latency and local terminal capabilities are
  irrelevant to whether the rename works.
- Confirm the nesting yourself: `tty` in the pane → `/dev/pts/7` (tmux's pty);
  detach and `tty` in the bare ssh shell → `/dev/pts/3` (sshd's pty).

### 5.3 File descriptors & how the other user "inherits" the pty

- A file descriptor is a small integer indexing a per-process table; entries
  point to shared kernel "open file descriptions." A pty slave is reached through
  an fd like any file.
- `sudo -iu oracle` does **not** allocate a new pty. The sequence is:
  1. **`fork()`** — child inherits **copies of the fd table**; fd 0/1/2 still
     point at `/dev/pts/7` (the same underlying open file).
  2. **`setuid(1001)`** — becoming oracle does **not** touch the fd table; the
     already-open handles remain valid.
  3. **`execve()`** — exec **preserves** open fds (0/1/2 aren't close-on-exec), so
     oracle's bash is born already wired to pts/7.
- **The pivotal rule: permission is checked at `open()` time, not at every
  `write()`.** bongo opened pts/7 (and had permission then). oracle merely
  inherited the handle — it never opens the device, so there's nothing to deny.
- Contrast with the socket: connecting to tmux's socket is a *fresh* `open`/
  `connect` → permission-checked → fails for oracle. The pty is an *inherited fd*
  → no new open → no check → succeeds.
- Writing the escape sequence is just `write(1, "\033koracle\033\\", 10)` — an
  ordinary write to a borrowed handle. No privilege escalation, no re-opening.
- Because it's the *same* open file description, the oracle shell shares the
  controlling terminal, session, and job control with pts/7 — it's genuinely the
  same terminal, not a copy. On exit, oracle's fd copies close; bongo's originals
  survive, and you drop back to bongo's prompt on the same pts/7.
- See it directly: `ls -l /proc/$$/fd` before and after `sudo -iu oracle` — fds
  0/1/2 symlink to the same `/dev/pts/7` on both sides.

### 5.4 Control path vs. data path — the crux

|                        |Control path                                  |Data path                                             |
|------------------------|----------------------------------------------|------------------------------------------------------|
|Mechanism               |`tmux rename-window`                          |`printf '\033k...\033\\'`                             |
|Reaches tmux via        |Unix socket `/tmp/tmux-<uid>/default`         |the pane's pty (your stdout)                          |
|Requires                |fresh connect → permission-checked            |write to inherited fd → no check                      |
|Other user (oracle/root)|**locked out** (dir is `0700`, owned by bongo)|**works** (writing your own stdout needs no privilege)|

The escape sequence **rides the one channel that crosses the privilege boundary
for free.** You're not asking tmux for anything; you're emitting a signal tmux
already happens to be listening for.

-----

## 6. Trade-offs & Repercussions (all fail *soft*)

- **Dropped the `_<command>` suffix** (e.g. `bongo_vim`). Capturing the running
  command needs a *preexec* hook firing *before* the command — in bash that means
  a `DEBUG` trap, the one piece that can collide with other prompt tooling
  (starship, oh-my-bash). Omitting it keeps the design to `PROMPT_COMMAND` only,
  which cannot wedge the shell. If wanted later, use the `bash-preexec` library
  rather than a hand-rolled trap.
- **TUI apps clobber the title.** vim, less, ssh set their own titles; the name
  flickers while they run and is restored at the next prompt.
- **Update only on prompt redraw.** If a sudo target's `.bashrc` block doesn't
  load, the window keeps the outer name until a prompt with the function fires.
- **Server-global tmux settings.** `automatic-rename off` removes command-based
  naming for *all* windows in that server, including ones without the block.
- **Raw binary dumps** can emit a stray `ESC k` and corrupt the title; the next
  prompt fixes it.
- **`id -un` forks per prompt** — negligible, but it is a subprocess each enter.
- **Not a security control.** Any process in the pane can set the title; the
  displayed user is orientation, not an authenticated privilege indicator.

Worst realistic outcome: a wrong or stale window title that self-corrects at the
next prompt. Nothing here can break tmux, wedge the shell, or touch the system.

-----

## 7. Hands-on Confirmations

```bash
ls -l /proc/$$/fd                 # fd inheritance: same pts before/after sudo -iu
printf '\033kTEST\033\\'          # fire a rename directly (run inside tmux)
cat -v                            # renders ESC as ^[ so you can spot sequences
tty                               # which pty you're on (pts/7 in tmux, pts/3 bare)
```

-----

## One-line mental model

> Control is checked at connect time and oracle is locked out; **data is checked
> at open time and oracle inherited an already-open handle** — so a bare
> `write()` of an escape sequence to your own stdout reaches the tmux parser
> that's already reading the pty, no privilege required.
