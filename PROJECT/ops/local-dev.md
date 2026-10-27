# Running entry locally for a measurement

```
DEBUG=1 HUB_WRITE_TOKEN=localhub ENTRY_ASSETS_DIR=<dir with models/ and vendor/> python manage.py runserver 127.0.0.1:8010 --noreload --nostatic
```

`--nostatic` is not optional. With the dev static handler on, `/static/` is answered before the
app's own route, without the isolation headers, and the streaming runtime's worker script is
refused with `net::ERR_BLOCKED_BY_RESPONSE`: the page boots, the mic opens, and the engine never
reports ready. It is the same failure that muted prod for 25 minutes in task 0033, in reverse.

The fake microphone for the probe (`--use-file-for-fake-audio-capture`) needs an ABSOLUTE path
to the wav; a relative one is silently a silent microphone (listen rows with peak 0, no text).
Headless Chromium crashes on this page's scene; run the probe headed.
