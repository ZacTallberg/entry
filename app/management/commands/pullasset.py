"""Pulls transcription assets onto the assets mount. Keys, not URLs — dokku run
eval-mangles quoted arguments, so everything here is a bare word."""
import os
import shutil
import urllib.request

_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0 Safari/537.36"


def _fetch(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": _UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=300) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)

from django.core.management.base import BaseCommand

_MS_MODEL = "https://download.moonshine.ai/model/tiny-streaming-en/quantized_26_07_30/"
_MS_CDN = "https://cdn.jsdelivr.net/npm/@moonshine-ai/moonshine-wasm@0.1.5/dist/"
_MS_DIR = "models/tiny-streaming-en/"
_MS_VENDOR = "vendor/moonshine/"

_MODEL_FILES = (
    "frontend.ort", "encoder.ort", "adapter.ort", "cross_kv.ort",
    "decoder_kv.ort", "streaming_config.json", "tokenizer.bin",
)
_RUNTIME_FILES = (
    "agent-flow.js",
    "asset-downloader.js",
    "embedding-model.js",
    "enums.js",
    "errors.js",
    "events.js",
    "grapheme-to-phonemizer.js",
    "index.js",
    "intent-recognizer.js",
    "mic-transcriber.js",
    "microphone-transcriber.js",
    "module.js",
    "moonshine.mjs",
    "moonshine.wasm",
    "stream.js",
    "stt-worker-host.js",
    "stt-worker-protocol.js",
    "stt-worker.js",
    "text-to-speech.js",
    "transcriber.js",
    "tts-worker-host.js",
    "tts-worker-protocol.js",
    "tts-worker.js",
    "types.js",
    "voice-clone.js",
)

ASSETS = {
    "streaming-model": [(_MS_MODEL + n, _MS_DIR + n) for n in _MODEL_FILES],
    "streaming-runtime": [(_MS_CDN + n, _MS_VENDOR + n) for n in _RUNTIME_FILES],
    "base-q4": [(
        "https://huggingface.co/onnx-community/moonshine-base-ONNX/resolve/main/onnx/decoder_model_merged_q4.onnx",
        "models/moonshine-base-ONNX/onnx/decoder_model_merged_q4.onnx",
    )],
    "tiny-q4": [(
        "https://huggingface.co/onnx-community/moonshine-tiny-ONNX/resolve/main/onnx/decoder_model_merged_q4.onnx",
        "models/moonshine-tiny-ONNX/onnx/decoder_model_merged_q4.onnx",
    )],
}


class Command(BaseCommand):
    help = "Download a known asset group onto the assets mount"

    def add_arguments(self, parser):
        parser.add_argument("key", choices=sorted(ASSETS))

    def handle(self, *args, **options):
        base = os.environ.get("ENTRY_ASSETS_DIR", "/app/assets")
        total = 0
        for url, rel in ASSETS[options["key"]]:
            dest = os.path.join(base, rel)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            _fetch(url, dest)
            size = os.path.getsize(dest)
            total += size
            self.stdout.write(f"{rel} {size}")
        self.stdout.write(f"TOTAL {options['key']} {total}")
