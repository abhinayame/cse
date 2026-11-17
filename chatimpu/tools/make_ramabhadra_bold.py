"""
Builds "Ramabhadra Chatimpu Bold" from Ramabhadra Regular (SIL OFL 1.1, no Reserved Font Name) by
emboldening every outline with FreeType. Ramabhadra ships in one weight only, and iOS does not
synthesise bold for custom fonts, so headlines and the wordmark need a real bold face.

    pip install fonttools freetype-py
    python tools/make_ramabhadra_bold.py <Ramabhadra_400Regular.ttf> <out.ttf>
"""
import ctypes, sys
import freetype
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import GlyphCoordinates

SRC, OUT = sys.argv[1], sys.argv[2]
SX, SY = 30, 16          # font units (UPM 830): ~3.6% horizontal, ~1.9% vertical stroke growth

font = TTFont(SRC)
glyf, hmtx = font['glyf'], font['hmtx']
face = freetype.Face(SRC)
emb = freetype.raw.FT_Outline_EmboldenXY

for name in font.getGlyphOrder():
    g = glyf[name]
    adv, lsb = hmtx[name]
    if g.isComposite():
        hmtx[name] = (adv + SX if adv else adv, lsb)
        continue
    if g.numberOfContours <= 0:
        continue
    face.load_glyph(font.getGlyphID(name), freetype.FT_LOAD_NO_SCALE | freetype.FT_LOAD_NO_HINTING)
    outline = face.glyph.outline
    err = emb(ctypes.byref(outline._FT_Outline), SX, SY)
    if err: raise RuntimeError(f'{name}: FreeType error {err}')
    pts = outline.points
    if len(pts) != len(g.coordinates):
        raise RuntimeError(f'{name}: point count changed')
    # FreeType grows the outline around its centre line; shift right so the left bearing is kept.
    g.coordinates = GlyphCoordinates([(x + SX // 2, y) for x, y in pts])
    g.program = type(g.program)() if hasattr(g, 'program') else g.program
    g.recalcBounds(glyf)
    hmtx[name] = (adv + SX if adv else adv, g.xMin)

# Outlines changed, so the original TrueType hinting programs no longer apply.
for t in ('fpgm', 'prep', 'cvt '):
    if t in font: del font[t]
for name in font.getGlyphOrder():
    g = glyf[name]
    if hasattr(g, 'program'):
        from fontTools.ttLib.tables import ttProgram
        p = ttProgram.Program(); p.fromBytecode(b''); g.program = p

font['OS/2'].usWeightClass = 700
font['OS/2'].fsSelection = (font['OS/2'].fsSelection | 0x20) & ~0x40   # BOLD, not REGULAR
font['head'].macStyle |= 0x1
family, style = 'Ramabhadra Chatimpu', 'Bold'
for rec in font['name'].names:
    if rec.nameID == 1: rec.string = family
    elif rec.nameID == 2: rec.string = style
    elif rec.nameID == 3: rec.string = f'{family} {style}; derived from Ramabhadra 1.0'
    elif rec.nameID == 4: rec.string = f'{family} {style}'
    elif rec.nameID == 6: rec.string = 'RamabhadraChatimpu-Bold'
    elif rec.nameID == 5: rec.string = 'Version 1.000; emboldened by Chatimpu (FreeType EmboldenXY 30/16)'
font.save(OUT)
print('wrote', OUT)
