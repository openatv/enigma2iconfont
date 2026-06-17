from os import listdir
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.varLib.instancer import instantiateVariableFont

font = TTFont("./generate/MaterialSymbolsSharp[FILL,GRAD,opsz,wght].ttf")

instance = instantiateVariableFont(
    font,
    {
        "wght": 300,
        "opsz": 100,
        "FILL": 0,
        "GRAD": 0,
    }
)

glyph_set = instance.getGlyphSet()

keys = glyph_set.keys()

names = listdir("./icons/google")
namesf = listdir("./icons/google_fill")

for name in names + namesf:
	gname = name.replace("_FILL.svg", ".fill").replace(".svg", "")

	if gname not in keys:
		print("Not found", gname)
		continue

	glyph = glyph_set[gname]
	pen = SVGPathPen(glyph_set)

	glyph.draw(pen)
	path = pen.getCommands()
	svg = f"""
<svg xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 960 960">
<g transform="translate(0,960) scale(1,-1)">
	<path fill="#000" d="{path}"/>
</g>
</svg>
"""
	with open("./inbox/google_" + name, "w") as fd:
		fd.write(svg)
