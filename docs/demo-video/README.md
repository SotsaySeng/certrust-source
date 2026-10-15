# Demo video and guide screenshots

One scripted run of the real app produces the tutorial video, the two marketing cuts,
and the screenshots on `/guide/issue-your-first-certificate`. Re-run it whenever those screens change.

| File | What |
|---|---|
| `tutorial.json` | Tutorial scene titles + narration (`captions`) + real spoken lengths (`durations`) |
| `marketing.json` | Marketing lines; `scenes` = which tutorial scene each line plays over |
| `../../src/frontend/e2e/demo-recording.spec.ts` | Drives the app, holds each scene as long as its narration, writes `out/timeline.json` and `public/guide/step-*.jpg` |
| `build.py` | Lays narration + captions on the recording -> `out/certrust-tutorial.mp4`, `certrust-marketing.mp4`, `certrust-marketing-9x16.mp4` |

`out/` is scratch (raw recording, wavs, renders); only the copy in `public/guide/` is shipped.

## Steps

1. **Narration** (only after editing the text): local Kokoro, voice `af_heart`.

       cd docs/demo-video
       ~/Documents/linkedin-posts/tools/voice/py312/bin/python ~/Documents/linkedin-posts/tools/voice/narrate.py tutorial.json af_heart
       ~/Documents/linkedin-posts/tools/voice/py312/bin/python ~/Documents/linkedin-posts/tools/voice/narrate.py marketing.json af_heart

   Spoken text is respelled where Kokoro needs it ("Sert trust" for Certrust: misaki drops "Cert", which it does not know; "C S V"); the on-screen titles keep the real spelling.
   If a tutorial line gets longer, record again (step 2) so the scene is held long enough.

2. **Record** on a fresh, isolated database (re-runs reuse the same demo email, so it must start empty):
   stop `certrust-demo-backend`, delete `src/backend/.tmp/demo-video.db*`, then start `certrust-demo-backend`
   and `certrust-demo-frontend` (`.claude/launch.json` in ProjectX; ports 1355 / 3022, dev mail catcher on,
   public site URL set to https://certrust.app so links on screen look real).

       cd src/frontend
       PW_DEMO=1 PW_SLOWMO=150 E2E_BASE_URL=http://localhost:3022 E2E_API_URL=http://localhost:1355 \
         E2E_DB_PATH=$PWD/../backend/.tmp/demo-video.db \
         npx playwright test e2e/demo-recording.spec.ts --config=playwright.local.config.ts

3. **Build** (needs an ffmpeg with libx264 + drawtext; `pip install imageio-ffmpeg` gives one):

       FFMPEG=/path/to/ffmpeg python3 docs/demo-video/build.py
       cp docs/demo-video/out/certrust-tutorial.mp4 src/frontend/public/guide/

## Gotchas

- The mail log (`src/backend/.tmp/mail/index.jsonl`) is shared by every local backend, so the spec waits
  for a message newer than the run start instead of taking the first match.
- Strapi's confirmation email prints its link as plain text, not an `<a>`.
