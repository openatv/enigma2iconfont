#!/usr/bin/env python3
"""Zero the OS/2 sTypoLineGap (and hhea lineGap) after fantasticon's build.

svg2ttf has no option to set sTypoLineGap; it always defaults it to 9% of
(ascent - descent), which is meant for body-text line spacing. Icon glyphs
are drawn to exactly fill their box (fontHeight/descent in fantasticonrc.cjs),
so that extra 9% throws off any renderer that centers text using the font's
line-height metric instead of the glyph's actual ink (e.g. Enigma2's
RT_VALIGN_CENTER, see eTextPara::calc_bbox() in lib/gdi/font.cpp).
"""
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

FONT_PATH = Path(__file__).resolve().parent.parent / "dist" / "fonts" / "enigma2icons.ttf"


def main():
	if not FONT_PATH.exists():
		print(f"[fix-metrics] Error: {FONT_PATH} not found (run build:font first)!")
		return 1

	font = TTFont(FONT_PATH)
	font["OS/2"].sTypoLineGap = 0
	font["hhea"].lineGap = 0
	font.save(FONT_PATH)
	print(f"[fix-metrics] sTypoLineGap/lineGap zeroed in {FONT_PATH}")
	return 0


if __name__ == "__main__":
	sys.exit(main())
