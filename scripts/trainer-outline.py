# Outlines "TRAINER" from Mona Sans at width 125 and weight 600, shaped by
# HarfBuzz (kerning included), for src/components/BrandName.tsx: prints the
# units per em, the cap height and, per glyph, its pen position, advance,
# ink bounds and SVG path (baseline at y = cap height).
#
#   python3 -m venv .venv && .venv/bin/pip install fonttools uharfbuzz
#   .venv/bin/python scripts/trainer-outline.py 'MonaSans[wdth,wght].ttf'
#
# The font is in google/fonts (ofl/monasans); see THIRD_PARTY_NOTICES.md.
import sys, json
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

src = sys.argv[1]
text = 'TRAINER'
loc = {'wdth': 125, 'wght': 600}

blob = hb.Blob.from_file_path(src)
face = hb.Face(blob)
font = hb.Font(face)
font.set_variations(loc)
buf = hb.Buffer()
buf.add_str(text)
buf.guess_segment_properties()
hb.shape(font, buf, {'kern': True, 'liga': False})

tt = instantiateVariableFont(TTFont(src), loc)
upem = tt['head'].unitsPerEm
cap = tt['OS/2'].sCapHeight
gs = tt.getGlyphSet()
order = tt.getGlyphOrder()

glyphs = []
x = 0
for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
    name = order[info.codepoint]
    pen = SVGPathPen(gs, lambda v: ('%.1f' % v).rstrip('0').rstrip('.'))
    # Flip y: font units go up, SVG down; the baseline at y = cap.
    gs[name].draw(TransformPen(pen, (1, 0, 0, -1, 0, cap)))
    bp = BoundsPen(gs); gs[name].draw(bp)
    glyphs.append({'d': pen.getCommands(), 'x': x + pos.x_offset, 'advance': pos.x_advance, 'bounds': bp.bounds})
    x += pos.x_advance
print(json.dumps({'upem': upem, 'cap': cap, 'glyphs': glyphs}))
