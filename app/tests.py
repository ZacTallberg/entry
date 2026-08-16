import re
from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase
from django.urls import reverse


class EntryExperienceTests(SimpleTestCase):
    def test_front_door_is_the_entry(self):
        response = self.client.get(reverse("app:home"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "The Entry — Say something into the dark")
        self.assertContains(response, "say something into the dark")
        self.assertContains(response, "nothing is sent. nothing is saved.")
        self.assertContains(response, 'data-graphics="fallback"')
        self.assertContains(response, 'href="/hub/"')
        self.assertNotContains(response, "<form")
        self.assertNotContains(response, 'name="entry-text"')

    def test_front_door_enforces_the_privacy_boundary(self):
        response = self.client.get(reverse("app:home"))
        csp = response.headers["Content-Security-Policy"]

        self.assertIn("connect-src 'none'", csp)
        self.assertIn("form-action 'none'", csp)
        self.assertNotIn("'unsafe-inline'", csp)
        self.assertNotIn("'unsafe-eval'", csp)
        self.assertEqual(response.headers["Referrer-Policy"], "no-referrer")
        self.assertEqual(response.headers["Cross-Origin-Opener-Policy"], "same-origin")
        self.assertEqual(response.headers["Cross-Origin-Resource-Policy"], "same-origin")

        refused = self.client.post(reverse("app:home"), {"entry-text": "private words"})
        self.assertEqual(refused.status_code, 405)
        self.assertNotContains(refused, "private words", status_code=405)

    def test_each_document_gets_a_fresh_script_nonce(self):
        first = self.client.get(reverse("app:home"))
        second = self.client.get(reverse("app:home"))
        pattern = r"script-src 'self' 'nonce-([^']+)'"
        first_nonce = re.search(pattern, first.headers["Content-Security-Policy"]).group(1)
        second_nonce = re.search(pattern, second.headers["Content-Security-Policy"]).group(1)

        self.assertNotEqual(first_nonce, second_nonce)
        self.assertGreaterEqual(first.content.decode().count(f'nonce="{first_nonce}"'), 2)

    def test_experience_has_no_content_transport_or_browser_storage(self):
        source = (settings.BASE_DIR / "app" / "static" / "app" / "entry.js").read_text(
            encoding="utf-8"
        )
        forbidden = (
            "fetch(",
            "XMLHttpRequest",
            "sendBeacon",
            "WebSocket",
            "localStorage",
            "sessionStorage",
            "indexedDB",
        )
        for primitive in forbidden:
            with self.subTest(primitive=primitive):
                self.assertNotIn(primitive, source)

    def test_local_assets_and_resilient_interaction_paths_are_present(self):
        response = self.client.get(reverse("app:home"))
        document = response.content.decode()
        javascript = (settings.BASE_DIR / "app" / "static" / "app" / "entry.js").read_text(
            encoding="utf-8"
        )
        stylesheet = (settings.BASE_DIR / "app" / "static" / "app" / "entry.css").read_text(
            encoding="utf-8"
        )

        self.assertNotIn("cdn.", document)
        self.assertIn("compositionstart", javascript)
        self.assertIn("compositionend", javascript)
        self.assertIn("insertFromPaste", javascript)
        self.assertIn("webglcontextlost", javascript)
        self.assertIn("visibilitychange", javascript)
        self.assertIn("prefers-reduced-motion", stylesheet)
        self.assertIn("forced-colors", stylesheet)

    def test_health_and_robots_are_content_free(self):
        health = self.client.get(reverse("app:health"))
        robots = self.client.get(reverse("app:robots"))

        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.json()["app"], "entry")
        self.assertIn("build", health.json())
        self.assertEqual(health.headers["Cache-Control"], "no-store")
        self.assertContains(robots, "Disallow: /hub/")
        self.assertContains(robots, "Disallow: /admin/")

    def test_declared_static_assets_exist(self):
        asset_root = Path(settings.BASE_DIR) / "app" / "static" / "app"
        for relative in (
            "entry.css",
            "entry.js",
            "icon.svg",
            "icon-64.png",
            "icon-180.png",
            "og.png",
            "fonts/roboto-flex.ttf",
            "vendor/three/three.module.js",
        ):
            with self.subTest(asset=relative):
                self.assertTrue((asset_root / relative).is_file())
