"""PDX Open Mic hub integration: the project adapter over the portable, stack-neutral hub_core.

Single source of truth = the event log in PROJECT/.hub. The Django views, the typed write API,
and `manage.py hubaudit` all go through here. Django-free at import time (uses __file__ paths +
hub_core only) so it is unit-testable without django.setup().
"""
import ast
import functools
import json
import os
import subprocess
from pathlib import Path

import hub_core
from hub_core import audit as _audit
from hub_core import project as _project

BASE_DIR = Path(__file__).resolve().parents[1]      # ...\openmic (repo root)
PROJECT = BASE_DIR / "PROJECT"
HUB_DIR = Path(os.environ.get("HUB_DIR") or (PROJECT / ".hub"))
SCHEMA_DIR = PROJECT / "schema"
SETTINGS_PY = BASE_DIR / "project_site" / "settings.py"
PROJECT_KEY = "entry"


@functools.lru_cache(maxsize=1)
def registry():
    return hub_core.Registry.from_dir(SCHEMA_DIR)


def store():
    """A fresh EventStore handle per call (cheap; avoids cross-thread sqlite handles)."""
    return hub_core.EventStore(HUB_DIR)


def current_state(st=None):
    return _project.state((st or store()).events())


def _git_head():
    try:
        r = subprocess.run(["git", "-C", str(BASE_DIR), "rev-parse", "--short", "HEAD"],
                           capture_output=True, text=True, timeout=4)
        return r.stdout.strip() or None
    except Exception:
        return None


def _running_sha():
    """The sha baked into the image at build time (app/build_sha.txt) — the RUNNING build's
    identity where there is no .git (the deployed container)."""
    try:
        return (BASE_DIR / "app" / "build_sha.txt").read_text(encoding="utf-8").strip() or None
    except OSError:
        return None


def _state_json() -> dict:
    p = PROJECT / "state.json"
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except ValueError:
            return {}
    return {}


def build_meta(served=None) -> dict:
    """The build/coherence block for /hub.json. `coherent` is COMPUTED, never read from state.json."""
    sj = _state_json()
    head = _git_head() or _running_sha()   # deployed container has no .git -> the baked sha IS the running identity
    sha = sj.get("last_deploy_sha")
    coherent = bool(head and sha and head == sha and (served is None or served == head))
    return {
        "repo": sj.get("repo_build"), "deploy": sj.get("last_deploy_build"),
        "tag": sj.get("last_deploy_tag"), "sha": sha, "served_sha": served, "head": head,
        "coherent": coherent, "live_url": sj.get("live_url"),
    }


# ---- behavioral audit adapters (the CHARTER security gate, AST not regex) ----

def _sv(vid, invariant, observed, expected="prod-safe default", remediation="require the env var; no unsafe default"):
    return {"id": vid, "kind": "ast", "severity": "high", "status": "open", "invariant": invariant,
            "observed": observed, "expected": expected, "evidence_uri": "", "remediation": remediation,
            "autofix_allowed": False}


def _call_default(value):
    """The literal 2nd arg of an env(...)/env_bool(...) call (the default), else None."""
    if isinstance(value, ast.Call) and len(value.args) >= 2:
        try:
            return ast.literal_eval(value.args[1])
        except Exception:
            return None
    return None


def settings_ast_adapter(state):
    """AST-scan config/settings.py for prod-unsafe defaults (DEBUG/SECRET_KEY/ALLOWED_HOSTS)."""
    viols = []
    try:
        tree = ast.parse(SETTINGS_PY.read_text(encoding="utf-8"))
    except Exception as e:
        return [_sv("settings:parse", "settings.py parses", str(e), "parseable", "fix the syntax error")]
    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign) or not node.targets:
            continue
        name = getattr(node.targets[0], "id", None)
        if name == "DEBUG" and _call_default(node.value) is True:
            viols.append(_sv("settings:debug", "DEBUG default is False", "DEBUG defaults to True"))
        elif name == "SECRET_KEY":
            d = _call_default(node.value)
            if isinstance(d, str) and d:
                viols.append(_sv("settings:secret_key", "SECRET_KEY has NO literal fallback",
                                 f"literal default {d[:18]!r}...", remediation="SECRET_KEY=os.environ['SECRET_KEY'] (no default)"))
        elif name == "ALLOWED_HOSTS":
            try:
                src = ast.unparse(node.value)
            except Exception:
                src = ""
            if '"*"' in src or "'*'" in src:
                viols.append(_sv("settings:allowed_hosts", "ALLOWED_HOSTS default is not '*'", "defaults to '*'"))
    return viols


def route_guard_adapter(state):
    """Auth-boundary primitive: assert EVERY mutating /hub/api/ route is token-gated (carries the
    @writer marker). Fail-closed. Skips cleanly in CLI context (runs in the served-context audit)."""
    try:
        from django.urls import get_resolver
        resolver = get_resolver()
    except Exception:
        return []
    viols = []

    def walk(patterns, prefix=""):
        for p in patterns:
            pat = prefix + str(getattr(p, "pattern", ""))
            sub = getattr(p, "url_patterns", None)
            if sub is not None:
                walk(sub, pat)
            elif "hub/api/" in pat:
                cb = getattr(p, "callback", None)
                if not getattr(cb, "_hub_token_gated", False):
                    viols.append(_sv("routes:unguarded", "every /hub/api/ route is token-gated",
                                     "%s -> %s NOT token-gated" % (pat, getattr(cb, "__name__", "?")),
                                     "token-gated (@writer)", remediation="wrap the view with @writer"))
    try:
        walk(resolver.url_patterns)
    except Exception as e:
        return [_sv("routes:introspect", "URLConf is walkable", str(e), "walkable")]
    return viols


def run_audit(st=None, served=None) -> dict:
    s = st or store()
    state = current_state(s)
    bm = build_meta(served)
    coh = {"head": bm["head"], "sha": bm["sha"], "served": served}
    # Unknowable coherence must SAY SO — a None head/sha silently skipping the checks was the
    # vacuous-green the openmic campaign hit in prod (audit green while identity was unmeasured).
    if not bm["head"]:
        coh["unknown"] = "running build identity unknown (no .git and no app/build_sha.txt)"
    elif not bm["sha"]:
        # Pre-first-deploy is a legitimate state: visible, but it must not block the very deploy
        # that creates the record.
        coh["unknown"] = "no deploy record yet (PROJECT/state.json last_deploy_sha missing — deploy.sh writes it)"
        coh["unknown_severity"] = "warn"
    return _audit.audit(state, registry(), store=s, coherence=coh,
                        adapters=[settings_ast_adapter, route_guard_adapter])


# ---- agent claims: a lease + fencing token so exactly one agent owns a task ----
import os as _os
import time as _time
import uuid as _uuid

CLAIMS = HUB_DIR / "claims"


def _claim_path(task_id):
    return CLAIMS / (task_id.replace(":", "_") + ".json")


def _read_lease(task_id):
    p = _claim_path(task_id)
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except ValueError:
        return None


def _write_lease(task_id, lease):
    CLAIMS.mkdir(parents=True, exist_ok=True)
    p = _claim_path(task_id)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(lease), encoding="utf-8")
    _os.replace(tmp, p)


def claim(task_id, agent, ttl_s=900):
    now = _time.time()
    cur = _read_lease(task_id)
    if cur and cur.get("expires", 0) > now and cur.get("agent") != agent:
        return {"ok": False, "reason": "held", "held_by": cur.get("agent"), "expires": cur.get("expires")}
    lease = {"task": task_id, "agent": agent, "token": _uuid.uuid4().hex,
             "claimed": now, "expires": now + ttl_s}
    _write_lease(task_id, lease)
    return {"ok": True, **lease}


def lease_valid(task_id, token):
    cur = _read_lease(task_id)
    return bool(cur and cur.get("token") == token and cur.get("expires", 0) > _time.time())


def heartbeat(task_id, token, ttl_s=900):
    cur = _read_lease(task_id)
    if not cur or cur.get("token") != token:
        return {"ok": False, "reason": "no/stale lease"}
    cur["expires"] = _time.time() + ttl_s
    _write_lease(task_id, cur)
    return {"ok": True, "expires": cur["expires"]}
