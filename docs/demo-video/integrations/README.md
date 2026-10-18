# Integration manuals: screenshots and videos

Google Sheets, Google Forms and Claude (MCP) tutorials + promos, built from full-resolution
screenshots of the real flows on production (demo organisation "Aroha Academy").

| File | What |
|---|---|
| `clean_stills.py` | Blurs private details (API key, Claude chat titles, other connectors, usage banner) in `out/integrations/shots/*.png` → `out/integrations/clean/` (for video) and `src/frontend/public/guide/integrations/*.jpg` (for the manual pages) |
| `<topic>-tutorial.json`, `<topic>-promo.json` | Scenes (still, zoom focus point, zoom), on-screen titles, spoken lines, and the narration `durations` |
| `build_videos.py` | Stills + narration → `out/integrations/videos/<name>.mp4` (1920x1080) and `<name>-9x16.mp4` for promos |

`out/` is git-ignored: raw captures, clean stills and full-quality videos live there.

## Rebuild

    python3 clean_stills.py                                   # Pillow
    KOKORO=~/Documents/ProjectX/.venvs/kokoro/bin/python
    for f in *-tutorial.json *-promo.json; do $KOKORO ~/Documents/linkedin-posts/tools/voice/narrate.py $f af_heart; done
    FFMPEG=/path/to/ffmpeg python3 build_videos.py            # Pillow + ffmpeg with libx264/drawtext

Web copies of the tutorials (Cloudflare rejects files over 25 MiB):

    for n in sheets forms claude; do ffmpeg -i ../out/integrations/videos/$n-tutorial.mp4 -c:v libx264 -preset slow -crf 30 \
      -tune stillimage -c:a aac -b:a 96k -movflags +faststart ../../../src/frontend/public/guide/integrations/$n-tutorial.mp4; done

## Gotchas

- Kokoro (misaki) silently drops words it doesn't know: check new lines for `❓` with `misaki.en.G2P(...)(text)[0]`.
  Respellings used: "Sert trust" (Certrust), "A P I", "M C P", "Anna Roo ease" (Ana Ruiz), "unverified" (not "verified").
- Captures came from the Claude app's browser pane via ffmpeg/`screencapture` of its screen area; the pane moves
  whenever the chat reflows, so it was re-located (magenta corner markers) before every capture.
- Google's OAuth pop-up fails inside embedded browsers ("An error occurred"); authorise the Apps Script once in a
  normal browser.
