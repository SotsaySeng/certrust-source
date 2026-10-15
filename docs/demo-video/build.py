"""Cut the recorded demo into the finished videos (stdlib only, needs ffmpeg).

    FFMPEG=/path/to/ffmpeg python3 docs/demo-video/build.py

Inputs (see README.md for how they are made):
  out/raw/tutorial.webm  the Playwright recording        (e2e/demo-recording.spec.ts)
  out/timeline.json      scene count + raw video path    (same spec; scene starts are read
                         from the corner marker in the video itself)
  tutorial.json / marketing.json  titles + narration durations (Kokoro narrate.py)
  out/tutorial.wav / out/marketing.wav  the narration

Outputs in out/:
  certrust-tutorial.mp4         full walkthrough, 16:9, every scene with its narration
  certrust-marketing.mp4        ~30 s cut, 16:9, scenes picked by marketing.json "scenes"
  certrust-marketing-9x16.mp4   the same cut for Reels / Shorts / TikTok
"""
import json, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
FONT = os.path.join(HERE, "../../src/frontend/public/design-fonts/inter-600.ttf")
FF = os.environ.get("FFMPEG") or shutil.which("ffmpeg") or sys.exit("set FFMPEG=/path/to/ffmpeg")


def load(name):
    return json.load(open(os.path.join(HERE, name)))


def esc(text):
    """Escape for a drawtext text= value inside a filtergraph."""
    return text.replace("\\", "\\\\").replace("'", "’").replace(":", "\\:").replace(",", "\\,").replace("%", "\\%")


def caption(text, start, end, w=1920):
    """A rounded-looking dark pill near the bottom with the scene title."""
    size = 44 if w >= 1920 else 54
    return (f"drawtext=fontfile='{FONT}':text='{esc(text)}':fontsize={size}:fontcolor=white"
            f":box=1:boxcolor=0x111827@0.82:boxborderw=26:x=(w-text_w)/2:y=h-text_h-90"
            f":enable='between(t,{start:.2f},{end:.2f})'")


def run(args):
    print("writing", os.path.basename(args[-1]))
    subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def video_timeline():
    """Scene starts as they appear in the video, read from the corner marker.

    The recording drifts seconds behind the spec's wall clock, so the times in
    timeline.json are only used to check the count. The spec flips a 12px
    marker red/blue at every scene start; take the first frame of each flip.
    """
    tl = json.load(open(os.path.join(OUT, "timeline.json")))
    fps = 25
    raw = subprocess.run([FF, "-loglevel", "error", "-i", tl["video"], "-vf", f"fps={fps},crop=6:6:iw-9:ih-9,scale=1:1",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    starts, last = [0.0], "red"
    for k in range(0, len(raw) - 2, 3):
        r, _, b = raw[k:k + 3]
        colour = "red" if r > 150 and b < 100 else "blue" if b > 150 and r < 100 else None
        if colour and colour != last:
            starts.append(k // 3 / fps)
            last = colour
    if len(starts) != len(tl["starts"]):
        sys.exit(f"found {len(starts)} scene markers in the video, expected {len(tl['starts'])}")
    return {"video": tl["video"], "starts": starts, "end": len(raw) // 3 / fps}


# Paint over the sync marker (page backgrounds there are white or near-white).
HIDE_MARKER = "drawbox=x=iw-14:y=ih-14:w=14:h=14:color=white:t=fill"


def narration_segments(spec):
    """(start, length) of each scene's clip inside the joined narration wav."""
    t, segs = 0.0, []
    for d in spec["durations"]:
        segs.append((t, d))
        t += d
    return segs


def tutorial():
    spec, tl = load("tutorial.json"), video_timeline()
    starts, end = tl["starts"], tl["end"]
    audio = []
    for i, (a, d) in enumerate(narration_segments(spec)):
        ms = int(starts[i] * 1000)
        audio.append(f"[1:a]atrim={a:.3f}:{a + d:.3f},asetpts=PTS-STARTPTS,adelay={ms}:all=1[a{i}]")
    mix = "".join(f"[a{i}]" for i in range(len(audio)))
    ends = starts[1:] + [end]
    # Scene 0 and the outro carry their own on-screen text (the homepage).
    caps = ",".join(caption(spec["titles"][i], starts[i], ends[i]) for i in range(1, len(starts) - 1))
    graph = ";".join([f"[0:v]{HIDE_MARKER},{caps},format=yuv420p[v]", *audio, f"{mix}amix=inputs={len(audio)}:normalize=0[a]"])
    run(["-i", tl["video"], "-i", os.path.join(OUT, "tutorial.wav"), "-filter_complex", graph,
         "-map", "[v]", "-map", "[a]", "-t", f"{end:.2f}",
         "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-c:a", "aac", "-b:a", "160k",
         "-movflags", "+faststart", os.path.join(OUT, "certrust-tutorial.mp4")])


def marketing():
    """Each marketing line plays over the end of its tutorial scene, sped up to fit."""
    spec, tl = load("marketing.json"), video_timeline()
    starts, end = tl["starts"], tl["end"]
    ends = starts[1:] + [end]
    parts, t = [], 0.0
    for j, scene in enumerate(spec["scenes"]):
        want = spec["durations"][j]
        length = ends[scene] - starts[scene]
        # ponytail: at most 1.8x speed-up, taken from the end of the scene where the result shows.
        take = min(length, want * 1.8)
        src = ends[scene] - take
        parts.append(f"[0:v]trim={src:.3f}:{src + take:.3f},setpts=(PTS-STARTPTS)*{want / take:.4f},fps=30[s{j}]")
    cat = "".join(f"[s{j}]" for j in range(len(parts))) + f"concat=n={len(parts)}:v=1:a=0,{HIDE_MARKER}[cut]"
    t, caps = 0.0, []
    for j, d in enumerate(spec["durations"]):
        caps.append((spec["titles"][j], t, t + d))
        t += d
    wide = ",".join(caption(x, a, b) for x, a, b in caps)
    tall = ",".join(caption(x, a, b, w=1080) for x, a, b in caps)
    wav = os.path.join(OUT, "marketing.wav")
    enc = ["-c:v", "libx264", "-preset", "slow", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest"]
    run(["-i", tl["video"], "-i", wav, "-filter_complex",
         ";".join([*parts, cat, f"[cut]{wide},format=yuv420p[v]"]),
         "-map", "[v]", "-map", "1:a", *enc, os.path.join(OUT, "certrust-marketing.mp4")])
    # 9:16: the middle of the 16:9 frame over a blurred, zoomed copy of itself.
    run(["-i", tl["video"], "-i", wav, "-filter_complex",
         ";".join([*parts, cat, "[cut]split[bg][fg]",
                   "[bg]scale=-2:1920,crop=1080:1920,boxblur=30:2,eq=brightness=-0.08[bgb]",
                   "[fg]crop=1340:1080,scale=1080:-2[fgs]",  # pages keep their content in the middle; trim side margins so text stays readable
                   f"[bgb][fgs]overlay=0:(H-h)/2,{tall},format=yuv420p[v]"]),
         "-map", "[v]", "-map", "1:a", *enc, os.path.join(OUT, "certrust-marketing-9x16.mp4")])


if __name__ == "__main__":
    tutorial()
    marketing()
    print("done:", ", ".join(f for f in sorted(os.listdir(OUT)) if f.endswith(".mp4")))
