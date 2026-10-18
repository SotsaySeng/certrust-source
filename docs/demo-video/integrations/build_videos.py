"""Turn the cleaned stills + Kokoro narration into the integration videos.

    FFMPEG=/path/to/ffmpeg python build_videos.py [name ...]     (needs Pillow)

For each <name>.json here (scenes: still, focus point, zoom; titles; spoken captions;
durations written by narrate.py) renders out/integrations/videos/<name>.mp4 (1920x1080),
and for *-promo also <name>-9x16.mp4. Each scene is a still with an eased zoom
towards its focus point, held a little longer than its narration.
"""
import json, os, shutil, subprocess, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CLEAN = os.path.join(HERE, '../out/integrations/clean')
OUT = os.path.join(HERE, '../out/integrations/videos')
TMP = os.path.join(OUT, 'tmp')
FONT = os.path.join(HERE, '../../../src/frontend/public/design-fonts/inter-600.ttf')
FF = os.environ.get('FFMPEG') or shutil.which('ffmpeg') or sys.exit('set FFMPEG=/path/to/ffmpeg')
FPS = 30
W, H = 1920, 1080


def run(args):
    subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)


def esc(text):
    return text.replace('\\', '\\\\').replace("'", '’').replace(':', '\\:').replace(',', '\\,').replace('%', '\\%')


def scene_clip(i, scene, seconds, dest):
    """One still, scaled to cover 2x the frame, eased zoom towards the focus point."""
    path = os.path.join(CLEAN, scene['shot'] + '.png')
    iw, ih = Image.open(path).size
    fx, fy = scene['focus']
    zoom = scene.get('zoom', 1.2)
    BW, BH = 2 * W, 2 * H
    if iw / ih < 1.3:   # portrait-ish (e.g. Google's permission screen): fit and pad, no crop
        base = f'scale={BW}:{BH}:force_original_aspect_ratio=decrease,pad={BW}:{BH}:(ow-iw)/2:(oh-ih)/2:color=white'
        fx, fy = 0.5, 0.5
    else:               # cover the 16:9 frame, keeping the focus point inside it
        s = max(BW / iw, BH / ih)
        sw, sh = round(iw * s / 2) * 2, round(ih * s / 2) * 2
        cx = min(max(fx * sw - BW / 2, 0), sw - BW)
        cy = min(max(fy * sh - BH / 2, 0), sh - BH)
        base = f'scale={sw}:{sh},crop={BW}:{BH}:{cx:.0f}:{cy:.0f}'
        fx, fy = (fx * sw - cx) / BW, (fy * sh - cy) / BH
    n = int(seconds * FPS)
    z = f'1+({zoom}-1)*(0.5-0.5*cos(PI*on/{n}))'
    zp = (f"zoompan=z='{z}':x='max(0,min(iw-iw/zoom,{fx:.4f}*iw-iw/zoom/2))'"
          f":y='max(0,min(ih-ih/zoom,{fy:.4f}*ih-ih/zoom/2))':d=1:s={W}x{H}:fps={FPS}")
    fade = f'fade=in:st=0:d=0.25,fade=out:st={seconds - 0.25:.2f}:d=0.25'
    run(['-loop', '1', '-framerate', str(FPS), '-t', f'{seconds:.3f}', '-i', path,
         '-vf', f'{base},{zp},{fade},format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', dest])


def caption(text, start, end, size):
    return (f"drawtext=fontfile='{FONT}':text='{esc(text)}':fontsize={size}:fontcolor=white"
            f":box=1:boxcolor=0x111827@0.82:boxborderw=24:x=(w-text_w)/2:y=h-text_h-80"
            f":enable='between(t,{start:.2f},{end:.2f})'")


def build(name):
    spec = json.load(open(os.path.join(HERE, name + '.json')))
    hold = 0.6 if name.endswith('promo') else 1.4
    lengths = [d + hold for d in spec['durations']]
    os.makedirs(TMP, exist_ok=True)
    clips = []
    for i, (scene, seconds) in enumerate(zip(spec['scenes'], lengths)):
        dest = os.path.join(TMP, f'{name}-{i:02d}.mp4')
        scene_clip(i, scene, seconds, dest)
        clips.append(dest)
    listfile = os.path.join(TMP, name + '.txt')
    open(listfile, 'w').write(''.join(f"file '{c}'\n" for c in clips))
    silent = os.path.join(TMP, name + '-silent.mp4')
    run(['-f', 'concat', '-safe', '0', '-i', listfile, '-c', 'copy', silent])

    # Narration: each scene's clip from the joined wav, placed at its scene start.
    starts, t = [], 0.0
    for L in lengths:
        starts.append(t)
        t += L
    wav = os.path.join(HERE, spec['audio'])
    parts, a = [], 0.0
    for i, d in enumerate(spec['durations']):
        parts.append(f'[1:a]atrim={a:.3f}:{a + d:.3f},asetpts=PTS-STARTPTS,adelay={int((starts[i] + 0.3) * 1000)}:all=1[a{i}]')
        a += d
    mix = ''.join(f'[a{i}]' for i in range(len(parts))) + f'amix=inputs={len(parts)}:normalize=0[a]'
    caps = [(spec['titles'][i], starts[i] + 0.2, starts[i] + lengths[i] - 0.2) for i in range(len(lengths))]
    enc = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart']
    os.makedirs(OUT, exist_ok=True)
    wide = ','.join(caption(x, s, e, 44) for x, s, e in caps)
    run(['-i', silent, '-i', wav, '-filter_complex', ';'.join([f'[0:v]{wide}[v]', *parts, mix]),
         '-map', '[v]', '-map', '[a]', '-t', f'{t:.2f}', *enc, os.path.join(OUT, name + '.mp4')])
    if name.endswith('promo'):
        # 9:16: the whole 16:9 frame in the middle, the scene title above it, the site below.
        title = ','.join(
            f"drawtext=fontfile='{FONT}':text='{esc(x)}':fontsize=62:fontcolor=white:box=1:boxcolor=0x111827@0.85"
            f":boxborderw=28:x=(w-text_w)/2:y=520:enable='between(t,{s:.2f},{e:.2f})'" for x, s, e in caps)
        site = f"drawtext=fontfile='{FONT}':text='certrust.app':fontsize=46:fontcolor=white:x=(w-text_w)/2:y=1440"
        run(['-i', silent, '-i', wav, '-filter_complex', ';'.join([
            '[0:v]split[bg][fg]',
            '[bg]scale=-2:1920,crop=1080:1920,boxblur=40:3,eq=brightness=-0.25[bgb]',
            '[fg]scale=1080:-2[fgs]',
            f'[bgb][fgs]overlay=0:(H-h)/2,{title},{site}[v]', *parts, mix]),
            '-map', '[v]', '-map', '[a]', '-t', f'{t:.2f}', *enc, os.path.join(OUT, name + '-9x16.mp4')])
    print(f'{name}: {t:.1f}s')


if __name__ == '__main__':
    names = sys.argv[1:] or sorted(f[:-5] for f in os.listdir(HERE) if f.endswith('.json'))
    for name in names:
        build(name)
