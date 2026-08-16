"""Build identity for the front-door canary: deploy.sh writes app/build_sha.txt pre-build, the base
template renders it as <meta name="build" content="build-<sha>">, and the deploy canary asserts the
LIVE page serves exactly this build — a stale or placeholder page can never pass."""
import os


def _sha():
    try:
        with open(os.path.join(os.path.dirname(__file__), "build_sha.txt"), encoding="utf-8") as f:
            return f.read().strip() or "dev"
    except OSError:
        return "dev"


def build_sha(request):
    return {"build_sha": _sha()}
