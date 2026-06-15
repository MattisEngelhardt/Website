"""
Camino flyover — DEM preparation.

Mosaics the two Copernicus GLO-30 tiles, crops to the route bounding box,
resamples to the mesh grid, and writes:
  - assets-src/camino/heights.npy  : float32 [H, W] metres, row 0 = NORTH
  - assets-src/camino/dem_meta.json : grid dims, elevation range, metric extent

Run with the GIS venv:
  C:/tmp/gisenv/Scripts/python.exe scripts/camino/prep_dem.py
"""
import json
import math
import os

import numpy as np
import rasterio
from rasterio.merge import merge
from rasterio.enums import Resampling

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "assets-src", "camino")
GEO = json.load(open(os.path.join(ROOT, "scripts", "camino", "geo.json")))

bb = GEO["bbox"]
W = GEO["grid"]["w"]
H = GEO["grid"]["h"]
LON_MIN, LAT_MIN, LON_MAX, LAT_MAX = bb["lonMin"], bb["latMin"], bb["lonMax"], bb["latMax"]

tiles = [os.path.join(SRC, "dem_N41.tif"), os.path.join(SRC, "dem_N42.tif")]
datasets = [rasterio.open(t) for t in tiles]

# crop + resample to the mesh grid in one merge pass (north-up, row 0 = LAT_MAX)
xres = (LON_MAX - LON_MIN) / W
yres = (LAT_MAX - LAT_MIN) / H
mosaic, _ = merge(
    datasets,
    bounds=(LON_MIN, LAT_MIN, LON_MAX, LAT_MAX),
    res=(xres, yres),
    resampling=Resampling.average,
)
for d in datasets:
    d.close()

heights = mosaic[0].astype(np.float32)            # [H, W], row 0 = north
heights = np.nan_to_num(heights, nan=0.0)
heights[heights < -50.0] = 0.0                    # nodata / below-geoid clamp → sea

# metric extent of the strip (mesh units = kilometres)
mid_lat = math.radians((LAT_MIN + LAT_MAX) / 2.0)
width_km = (LON_MAX - LON_MIN) * 111.320 * math.cos(mid_lat)
depth_km = (LAT_MAX - LAT_MIN) * 111.320

np.save(os.path.join(SRC, "heights.npy"), heights)

meta = {
    "bbox": bb,
    "grid": {"w": int(heights.shape[1]), "h": int(heights.shape[0])},
    "rowOrder": "north_to_south",
    "elevMin": float(heights.min()),
    "elevMax": float(heights.max()),
    "widthKm": width_km,
    "depthKm": depth_km,
    "exaggeration": GEO["exaggeration"],
}
json.dump(meta, open(os.path.join(SRC, "dem_meta.json"), "w"), indent=2)

print("heights:", heights.shape, "elev", round(meta["elevMin"], 1), "to", round(meta["elevMax"], 1), "m")
print("strip:", round(width_km, 1), "km wide ×", round(depth_km, 1), "km long")
print("wrote heights.npy + dem_meta.json")
