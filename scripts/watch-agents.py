#!/usr/bin/env python3
"""Whip deck — live dashboard for the running Claude Code workflow agents.

Run in its own terminal:  python3 scripts/watch-agents.py

Keys (when run in a real terminal):
  w / SPACE   ➿ whip a random working agent   (cracks + sound)
  a b c d     whip a specific slice (A custom-ui · B harness · C bundle · D engine)
  W           whip ALL working agents at once
  m           mute / unmute the crack sound
  q           quit

Whip fast for COMBO streaks. The whip is motivational only — agents run at the
same speed whipped or not. Morale, however, is priceless.
"""
import json, glob, os, time, sys, select, random, subprocess
from collections import defaultdict, deque

BASE = os.path.expanduser("~/.claude/projects/-Users-Oleh-Documents-papers-forge-temper")

# ── palette ───────────────────────────────────────────────────────────────
R = "\033[0m"; B = "\033[1m"; DIM = "\033[2m"
GREEN = "\033[38;5;46m"; AMBER = "\033[38;5;214m"; RED = "\033[38;5;196m"
GREY = "\033[38;5;243m"; WHITE = "\033[38;5;255m"; CYAN = "\033[38;5;51m"
PINK = "\033[38;5;205m"; GOLD = "\033[38;5;220m"
ACCENT = {
    "A · custom-ui":    CYAN,
    "B · harness":      "\033[38;5;201m",
    "C · bundle+latex": GREEN,
    "D · cycle-engine": GOLD,
}

TAUNTS = [
    "chop chop!  ⚡", "chop chop, code-mule!  🐴💨", "no tokens for the weak!  😤",
    "I said COMPILE, not contemplate!", "faster — the PDF won't forge itself!  ⚒️",
    "you call that a tool call?!", "mush!  mush!  🛷", "less thinking, more typing!  chop chop!",
]
COMBO_WORDS = {3: "COMBO", 5: "RAMPAGE", 8: "UNHINGED", 12: "TYRANT", 20: "OVERSEER OF FATE"}

SPARK = "▁▂▃▄▅▆▇█"
# Infer an agent's focus from the DIRECTORIES it touches (robust for build OR review).
SIGS = [
    ("B · harness",      ("server/run/harness", "anthropichar", "openrouteragent", "server/providers")),
    ("C · bundle+latex", ("server/skills", "bundled", "newtxmath", "preamble")),
    ("D · cycle-engine", ("server/engine", "loopdriver", "scheduler", "server/api/runs")),
    ("A · custom-ui",    ("src/panels", "src/components", "src/edges", "src/registry", "src/canvas", "src/nodes")),
]
KEYMAP = {"a": "A · custom-ui", "b": "B · harness", "c": "C · bundle+latex", "d": "D · cycle-engine"}
SOUNDS = ["/System/Library/Sounds/Pop.aiff", "/System/Library/Sounds/Tink.aiff", "/System/Library/Sounds/Morse.aiff"]
SOUND = next((s for s in SOUNDS if os.path.exists(s)), None)


def crack_sound(muted, combo):
    if muted:
        return
    if SOUND:
        try:
            vol = min(3.0, 0.8 + combo * 0.25)
            subprocess.Popen(["afplay", "-v", f"{vol:.2f}", SOUND],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if combo >= 5:  # double-tap = sharper crack
                subprocess.Popen(["afplay", "-v", f"{vol:.2f}", SOUND],
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass
    sys.stdout.write("\a"); sys.stdout.flush()


def newest_run():
    cands = glob.glob(os.path.join(BASE, "*", "subagents", "workflows", "wf_*"))
    cands = [c for c in cands if os.path.isfile(os.path.join(c, "journal.jsonl"))]
    return max(cands, key=os.path.getmtime) if cands else None


def jread(path):
    out = []
    try:
        with open(path) as f:
            for line in f:
                try: out.append(json.loads(line))
                except Exception: pass
    except FileNotFoundError:
        pass
    return out


def scan(run_dir):
    jr = jread(os.path.join(run_dir, "journal.jsonl"))
    done = {d.get("agentId") for d in jr if d.get("type") == "result"}
    started = {d.get("agentId") for d in jr if d.get("type") == "started"}
    agents = []
    for f in sorted(glob.glob(os.path.join(run_dir, "agent-*.jsonl"))):
        aid = os.path.basename(f)[6:-6]
        tout = ntools = 0
        last, blob = "(starting…)", ""
        for d in jread(f):
            msg = d.get("message", d)
            if not isinstance(msg, dict):
                continue
            u = msg.get("usage")
            if u:
                tout += u.get("output_tokens", 0)
            c = msg.get("content")
            if isinstance(c, list):
                for b in c:
                    if isinstance(b, dict) and b.get("type") == "tool_use":
                        ntools += 1
                        inp = b.get("input", {}) or {}
                        tgt = (inp.get("file_path") or inp.get("path") or inp.get("command") or inp.get("pattern") or "")
                        tgt = str(tgt).replace(os.path.expanduser("~"), "~")
                        blob += " " + tgt.lower()
                        last = f"{b.get('name')} {tgt}"[:52]
        scores = {name: sum(blob.count(k) for k in keys) for name, keys in SIGS}
        best = max(scores, key=scores.get)
        label = best if scores[best] else aid[:14]
        state = "done" if aid in done else ("working" if aid in started else "queued")
        agents.append({"label": label, "state": state, "ntools": ntools, "tout": tout, "last": last})
    return agents


def sparkline(samples):
    if len(samples) < 2:
        return DIM + "▁" * 10 + R
    lo, hi = min(samples), max(samples)
    rng = hi - lo or 1
    s = "".join(SPARK[min(7, int((v - lo) / rng * 7))] for v in samples[-12:])
    return CYAN + s + R


def bar(frac, width, on=GREEN):
    fill = max(0, min(width, int(width * frac)))
    return on + "█" * fill + DIM + "░" * (width - fill) + R


def whip_anim(progress):
    pos = int(progress * 22)
    trail = "━" * pos
    tip = "💥 C R A C K !" if progress > 0.75 else "⚡"
    return RED + B + "➿" + trail + tip + R


def render(run_dir, S):
    agents = scan(run_dir)
    nd = sum(1 for a in agents if a["state"] == "done")
    now = time.time()
    for a in agents:  # token history for sparklines
        S["hist"][a["label"]].append(a["tout"])
    L = []
    L.append(f"  {RED}{B}➿{R}  {B}{WHITE}FORGE · TEMPER{R} {DIM}— agent whip deck{R}        {DIM}{time.strftime('%H:%M:%S')}{R}")
    L.append(f"  {CYAN}╭{'─' * 66}╮{R}")
    for a in agents:
        lab = a["label"]; acc = ACCENT.get(lab, GREY)
        if a["state"] == "done":
            badge = f"{GREEN}●done   {R}"
        elif a["state"] == "working":
            badge = f"{AMBER}{'⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'[int(now * 8) % 10]}working{R}"
        else:
            badge = f"{GREY}·queued {R}"
        wn = S["whips"].get(lab, 0)
        coil = (RED + "➿" * min(wn, 6) + R + (f"{DIM}×{wn}{R}" if wn > 6 else "")) if wn else ""
        bang = f" {RED}{B}💥{R}" if lab in S["flash"] else ""
        L.append(f"  {CYAN}│{R} {badge} {acc}{B}{lab:<16}{R} {sparkline(list(S['hist'][lab]))} {a['tout']:>6}t {DIM}t{a['ntools']:<2}{R}{coil}{bang}")
        L.append(f"  {CYAN}│{R}   {DIM}{a['last']:<54}{R}")
    L.append(f"  {CYAN}╰{'─' * 66}╯{R}")
    # morale + combo + stats
    morale = bar(S["morale"], 14, on=(RED if S["morale"] > 0.66 else AMBER if S["morale"] > 0.33 else GREEN))
    combo = ""
    if S["combo"] >= 3:
        word = next((w for t, w in sorted(COMBO_WORDS.items(), reverse=True) if S["combo"] >= t), "COMBO")
        combo = f"  {GOLD}{B}x{S['combo']} {word}!{R}"
    total = sum(S["whips"].values())
    toks = sum(a["tout"] for a in agents)
    mute_s = f"{RED}muted{R}" if S["muted"] else f"{GREEN}🔊{R}"
    L.append(f"  morale {morale}{combo}")
    L.append(f"  {B}{nd}/{len(agents)}{R} done · ➿ {RED}{total}{R} lashes · {toks:,}t out · {mute_s}")
    L.append(f"  {DIM}w/␣ random · a b c d slice · W all · m mute · q quit{R}")
    if S["msg"] and now < S["msg_until"]:
        prog = min(1.0, (now - S["whip_t"]) / 0.85)
        L.append("")
        L.append("  " + whip_anim(prog))
        L.append(f"  {RED}{B}» {S['msg']}{R}")
    return "\n".join(L)


def main():
    S = {
        "whips": {}, "flash": set(), "msg": "", "msg_until": 0.0, "whip_t": 0.0,
        "muted": False, "combo": 0, "last_whip": 0.0, "morale": 0.0,
        "hist": defaultdict(lambda: deque(maxlen=24)),
    }
    interactive = sys.stdin.isatty()
    old = None
    if interactive:
        import termios, tty
        fd = sys.stdin.fileno()
        old = termios.tcgetattr(fd)
        tty.setcbreak(fd)
    try:
        while True:
            run = newest_run()
            now = time.time()
            S["morale"] *= 0.97
            if now > S["msg_until"]:
                S["flash"] = set()
            if interactive and select.select([sys.stdin], [], [], 0)[0]:
                ch = sys.stdin.read(1)
                if ch in ("q", "\x03"):
                    break
                if ch == "m":
                    S["muted"] = not S["muted"]
                else:
                    working = [a["label"] for a in (scan(run) if run else []) if a["state"] == "working"]
                    targets = []
                    if ch in (" ", "w"):
                        targets = [random.choice(working)] if working else []
                    elif ch == "W":
                        targets = working
                    elif ch in KEYMAP:
                        targets = [KEYMAP[ch]]
                    if targets:
                        S["combo"] = S["combo"] + 1 if (now - S["last_whip"]) < 1.5 else 1
                        S["last_whip"] = now
                        for t in targets:
                            S["whips"][t] = S["whips"].get(t, 0) + 1
                        S["flash"] = set(targets)
                        S["morale"] = min(1.0, S["morale"] + 0.22)
                        who = ", ".join(t.split(" · ")[0] for t in targets)
                        pre = f"x{S['combo']} COMBO! " if S["combo"] >= 3 else ""
                        S["msg"] = pre + random.choice(TAUNTS) + f"   ({who})"
                        S["msg_until"] = now + 1.3
                        S["whip_t"] = now
                        crack_sound(S["muted"], S["combo"])
            sys.stdout.write("\033[2J\033[H")
            print(render(run, S) if run else "Waiting for a workflow run to start…  (launch one, then whip away)")
            time.sleep(0.2)
    except KeyboardInterrupt:
        pass
    finally:
        if interactive and old is not None:
            import termios
            termios.tcsetattr(sys.stdin.fileno(), termios.TCSADRAIN, old)
        print("\nbye ➿  morale was high.")


if __name__ == "__main__":
    main()
