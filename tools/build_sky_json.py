"""Convertit un flux RGB brut (3 octets par image) en JSON de couleurs hexadécimales."""
import json, sys

raw = open(sys.argv[1], "rb").read()
colors = ["#%02x%02x%02x" % tuple(raw[i:i + 3]) for i in range(0, len(raw) - 2, 3)]
json.dump(colors, open(sys.argv[2], "w"))
print(f"{sys.argv[2]} : {len(colors)} couleurs ({colors[0]} → {colors[-1]})")
