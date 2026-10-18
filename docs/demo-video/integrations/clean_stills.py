"""Blur private details in the captured stills; write video + website copies.

    python clean_stills.py   (needs Pillow)

Reads   out/integrations/shots/*.png   (raw captures, git-ignored)
Writes  out/integrations/clean/*.png   (full size, for build_videos.py)
        ../../src/frontend/public/guide/integrations/*.jpg  (1600 px, for the manual pages)
Blur boxes are fractions of the image (x0, y0, x1, y1).
"""
import glob, os
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '../out/integrations/shots')
CLEAN = os.path.join(HERE, '../out/integrations/clean')
WEB = os.path.join(HERE, '../../../src/frontend/public/guide/integrations')

CLAUDE_SIDEBAR = (0, 0.3, 0.105, 1)   # recent chat titles behind the settings window
BLUR = {
    'sheets-1b-key-created': [(0.13, 0.46, 0.80, 0.52), (0.14, 0.70, 0.30, 0.73)],  # the API key + its prefix
    'claude-1-connectors': [CLAUDE_SIDEBAR, (0.26, 0.21, 0.63, 0.66)],              # + the user's other connectors
    'claude-2-add-custom-connector': [CLAUDE_SIDEBAR],
    'claude-3-auth-detected': [CLAUDE_SIDEBAR],
    'claude-4-not-connected-yet': [CLAUDE_SIDEBAR],
    'claude-6-connected-tools': [CLAUDE_SIDEBAR],
    'claude-7d-issued': [(0.20, 0.82, 0.80, 0.875)],                                 # usage-limit banner
}
TRIM_LEFT = {'sheets-2b-script-pasted': 6, 'sheets-2c-script-saved': 6, 'sheets-3c-connect-dialog': 10}  # px of chat pane


def main():
    os.makedirs(CLEAN, exist_ok=True)
    os.makedirs(WEB, exist_ok=True)
    for path in sorted(glob.glob(os.path.join(SRC, '*.png'))):
        name = os.path.basename(path)[:-4]
        im = Image.open(path).convert('RGB')
        if name in TRIM_LEFT:
            im = im.crop((TRIM_LEFT[name], 0, im.width, im.height))
        for x0, y0, x1, y1 in BLUR.get(name, []):
            box = (int(x0 * im.width), int(y0 * im.height), int(x1 * im.width), int(y1 * im.height))
            im.paste(im.crop(box).filter(ImageFilter.GaussianBlur(18)), box)
        im.save(os.path.join(CLEAN, name + '.png'))
        web = im.copy()
        web.thumbnail((1600, 1600))
        web.save(os.path.join(WEB, name + '.jpg'), quality=82, optimize=True)
    print('cleaned', len(os.listdir(CLEAN)), 'stills')


if __name__ == '__main__':
    main()
