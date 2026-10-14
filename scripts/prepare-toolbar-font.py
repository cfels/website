from io import BytesIO
from pathlib import Path
import struct
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

output = Path(__file__).resolve().parents[1] / 'static/assets/fonts'
font = TTFont(sys.argv[1], recalcTimestamp=False)
license_text = font['name'].getDebugName(13)
if not license_text or 0x21BB not in font.getBestCmap():
    raise ValueError('The source font must include a license and the clockwise open-circle arrow.')
if font['OS/2'].fsType != 0:
    raise ValueError('The source font must permit unrestricted embedding.')
options = subset.Options()
options.recalc_timestamp = False
subsetter = subset.Subsetter(options)
subsetter.populate(unicodes=[0x21BB])
subsetter.subset(font)
for name_id, text in [(1, 'Moxiu Toolbar'), (2, 'Regular'), (3, 'Moxiu Toolbar 1.0'), (4, 'Moxiu Toolbar'), (5, 'Version 1.0'), (6, 'MoxiuToolbar')]:
    for platform, encoding, language in [(3, 1, 0x409), (1, 0, 0)]:
        font['name'].setName(text, name_id, platform, encoding, language)
data = BytesIO()
font.save(data)
ttf = data.getvalue()
font = TTFont(BytesIO(ttf), recalcTimestamp=False)
os2 = font['OS/2']
panose_fields = ['bFamilyType', 'bSerifStyle', 'bWeight', 'bProportion', 'bContrast',
                 'bStrokeVariation', 'bArmStyle', 'bLetterForm', 'bMidline', 'bXHeight']
panose = bytes(getattr(os2.panose, field) for field in panose_fields)
names = bytearray()
for text in ['Moxiu Toolbar', 'Regular', 'Version 1.0', 'Moxiu Toolbar']:
    encoded = text.encode('utf-16le')
    names.extend(struct.pack('<H', len(encoded)) + encoded + b'\0\0')
names.extend(b'\0\0')
header = struct.pack(
    '<IIII10sBBIHH11IH',
    82 + len(names) + len(ttf), len(ttf), 0x20001, 0,
    panose, 1, 0, os2.usWeightClass, os2.fsType, 0x504C,
    os2.ulUnicodeRange1, os2.ulUnicodeRange2, os2.ulUnicodeRange3, os2.ulUnicodeRange4,
    os2.ulCodePageRange1, os2.ulCodePageRange2,
    font['head'].checkSumAdjustment, 0, 0, 0, 0, 0,
)
(output / 'toolbar.eot').write_bytes(header + names + ttf)
(output / 'toolbar-LICENSE.txt').write_text(license_text + '\n', encoding='utf-8')
