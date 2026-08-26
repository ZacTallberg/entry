"""Pulls a known transcription asset onto the mount. Keys, not URLs — dokku run
eval-mangles quoted arguments, so everything here is a bare word."""
import os
import urllib.request

from django.core.management.base import BaseCommand

ASSETS = {
    "base-q4": (
        "https://huggingface.co/onnx-community/moonshine-base-ONNX/resolve/main/onnx/decoder_model_merged_q4.onnx",
        "models/moonshine-base-ONNX/onnx/decoder_model_merged_q4.onnx",
    ),
    "tiny-q4": (
        "https://huggingface.co/onnx-community/moonshine-tiny-ONNX/resolve/main/onnx/decoder_model_merged_q4.onnx",
        "models/moonshine-tiny-ONNX/onnx/decoder_model_merged_q4.onnx",
    ),
}


class Command(BaseCommand):
    help = "Download a known model asset onto the assets mount"

    def add_arguments(self, parser):
        parser.add_argument("key", choices=sorted(ASSETS))

    def handle(self, *args, **options):
        url, rel = ASSETS[options["key"]]
        dest = os.path.join(os.environ.get("ENTRY_ASSETS_DIR", "/app/assets"), rel)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        urllib.request.urlretrieve(url, dest)
        self.stdout.write(f"pulled {options['key']} -> {dest} ({os.path.getsize(dest)} bytes)")
