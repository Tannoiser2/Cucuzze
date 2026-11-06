#!/usr/bin/env python3
"""Controlla che ogni carattere usato nei testi del gioco esista nei font (Chewy e Nunito).
Uso: python3 tools/controlla_glifi.py   (richiede: pip install fonttools brotli)"""
import re, sys, pathlib
from fontTools.ttLib import TTFont
R = pathlib.Path(__file__).resolve().parent.parent / "docs"
fonts = {f: set(TTFont(R / "fonts" / f).getBestCmap()) for f in ["chewy.woff2", "nunito-700.woff2", "nunito-900.woff2"]}
testo = ""
for f in ["engine.js", "game.js"]:
    src = (R / f).read_text(encoding="utf8")
    src = re.sub(r"<svg.*?</svg>", "", src)  # le icone SVG non sono testo
    testo += "".join(re.findall(r'"((?:[^"\\]|\\.)*)"', src)) + "".join(re.findall(r"'((?:[^'\\]|\\.)*)'", src))
html = (R / "index.html").read_text(encoding="utf8")
testo += re.sub(r"<style>.*?</style>|<[^>]+>", " ", html, flags=re.S)
caratteri = sorted(set(c for c in testo if ord(c) >= 32))
errori = 0
for nome, cmap in fonts.items():
    mancanti = [c for c in caratteri if ord(c) not in cmap]
    if mancanti:
        errori += 1
        print("MANCANO in", nome + ":", " ".join("%s(U+%04X)" % (c, ord(c)) for c in mancanti))
non_ascii = [c for c in caratteri if ord(c) > 126]
print("Caratteri non ASCII usati:", " ".join(non_ascii) or "nessuno")
print("OK: tutti i glifi esistono nei font" if not errori else "ERRORE: glifi mancanti")
sys.exit(1 if errori else 0)
