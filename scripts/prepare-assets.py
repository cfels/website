from pathlib import Path
from shutil import copy2, copytree
import subprocess

from fontTools import subset

root = Path(__file__).resolve().parents[1]
source = root / 'src/lib/assets'
output = root / 'static/assets'
for folder in ('additions', 'fonts', 'navigation'):
    (output / folder).mkdir(parents=True, exist_ok=True)


def image(*arguments):
    subprocess.run(['magick', *map(str, arguments)], check=True)


image(source / 'bg/luckybg_main.jpg', '-resize', '800x', '-strip', '-quality', 82, output / 'luckybg_main.webp')
image(source / 'logo/logo.png', '-resize', '54x', '-strip', output / 'logo.png')
copy2(source / 'konata/konata_cutout.webp', output / 'konata_cutout.webp')
copytree(source / 'buttons', output / 'buttons', dirs_exist_ok=True)
for path in sorted((source / 'additions').iterdir()):
    image(path, '-resize', '240x320>', '-strip', '-quality', 83, output / 'additions' / (path.stem + '.webp'))
image('-size', '8x8', 'xc:#fff1c6', '-fill', '#ffe59a', '-draw', 'rectangle 0,0 3,3 rectangle 4,4 7,7', '-strip', output / 'checker.png')
image(source / 'additions/3.webp', '-crop', '725x725+220+20', '+repage', '-resize', '16x16', '-strip', output / 'favicon.png')

labels = {'home': 'Home', 'profile': 'About me', 'contact': 'Contact', 'links': 'Bookmarks', 'support': 'Support', 'gallery': 'Gallery'}
for name, label in labels.items():
    image(root / 'scripts/navigation-button.png',
          '-font', output / 'fonts/comic-bold.woff2', '-pointsize', 12, '-gravity', 'center',
          '-fill', '#ba1c65', '-annotate', '+1+1', label, '-fill', 'white', '-annotate', '+0+0', label,
          '-depth', 8, '-strip', output / 'navigation' / (name + '.png'))
image('-size', '300x27', 'gradient:#ffc1de-#f579aa', '-fill', '#f0418b', '-stroke', 'none', '-draw',
      'polygon 11,3 13,8 18,8 14,12 16,17 11,14 7,18 7,12 3,9 9,8 polygon 24,11 25,15 29,16 26,18 26,22 23,20 20,22 21,18 18,15 23,15',
      '-strip', output / 'section.png')

fonts = {'comic': 'ComicSans/COMIC.TTF', 'comic-bold': 'ComicSans/COMICBD.TTF', 'verdana': 'Verdana/VERDANA.ttf', 'tahoma': 'Tahoma/TAHOMA.ttf'}
characters = list(range(0x20, 0x180)) + list(range(0x2000, 0x2070)) + [0x2606, 0x2605, 0x2661, 0x2652, 0x2190, 0x2192, 0x21bb, 0x3002]
for name, path in fonts.items():
    options = subset.Options()
    options.flavor = 'woff2'
    options.recalc_timestamp = False
    font = subset.load_font(str(source / 'fonts' / path), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=characters)
    subsetter.subset(font)
    subset.save_font(font, str(output / 'fonts' / (name + '.woff2')), options)
