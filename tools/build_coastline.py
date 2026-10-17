"""Clip the article's seven coastal ADM1 regions to the checked-in OSM land mask.

Run from any directory: python tools/build_coastline.py
Requires Shapely 2.2.0. Statistical data and inland geometries are not regenerated.
"""

import json
from pathlib import Path

from shapely import make_valid, normalize, set_precision
from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "data/ukraine_oblasts.geojson"
COASTAL = {"UA-65", "UA-14", "UA-23", "UA-51", "UA-48", "UA-43", "UA-40"}
SOURCE = {
    "administrativeBoundaries": {
        "file": "tools/raw/ukraine_adm1_geoboundaries.geojson",
        "source": "https://www.geoboundaries.org/",
        "license": "CC BY 4.0",
    },
    "coastlineLandMask": {
        "file": "presentation/data/geo.json#land",
        "source": "https://osmdata.openstreetmap.de/data/land-polygons.html",
        "attribution": "© OpenStreetMap contributors",
        "license": "ODbL 1.0",
        "licenseUrl": "https://www.openstreetmap.org/copyright",
        "precision": "Checked-in land mask rounded to 0.01 degrees; not a survey coastline",
    },
    "method": "Seven coastal ADM1 regions intersected with repaired OSM land polygons; inland geometries unchanged",
}


def polygon_parts(geometry):
    """Discard lines/points left by repairing the rounded land mask."""
    if geometry.is_empty:
        return []
    if geometry.geom_type == "Polygon":
        return [geometry]
    if hasattr(geometry, "geoms"):
        return [part for child in geometry.geoms for part in polygon_parts(child)]
    return []


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def rounded_coordinates(coordinates):
    if isinstance(coordinates[0], (int, float)):
        return [round(value, 5) for value in coordinates]
    return [rounded_coordinates(child) for child in coordinates]


def main():
    article = read_json(TARGET)
    raw = read_json(ROOT / "tools/raw/ukraine_adm1_geoboundaries.geojson")
    reference = read_json(ROOT / "presentation/data/geo.json")
    by_iso = {feature["properties"]["shapeISO"]: feature for feature in raw["features"]}
    isos = [feature["properties"]["iso"] for feature in article["features"]]
    if len(isos) != 27 or len(set(isos)) != 27 or not COASTAL.issubset(isos):
        raise ValueError("Expected all 27 Ukrainian ADM1 regions including Crimea and Sevastopol")

    land_polygons = [Polygon(rings[0], rings[1:]) for rings in reference["land"]]
    repaired_count = sum(not polygon.is_valid for polygon in land_polygons)
    land = unary_union([
        part for polygon in land_polygons for part in polygon_parts(make_valid(polygon))
    ])
    if not land.is_valid:
        raise ValueError("Repaired land union must be valid")

    for feature in article["features"]:
        iso = feature["properties"]["iso"]
        if iso not in COASTAL:
            continue
        # Always start from raw ADM1, so repeated runs cannot erode the coast.
        original = shape(by_iso[iso]["geometry"])
        if not original.is_valid:
            raise ValueError(f"Invalid raw administrative geometry: {iso}")
        clipped = original.intersection(land)
        # Precision reduction preserves topology and removes collapsed slivers.
        polygons = polygon_parts(set_precision(unary_union(polygon_parts(clipped)), 0.00001))
        if not polygons:
            raise ValueError(f"Clipping removed every land polygon: {iso}")
        # Canonical order gives repeatable output; D3 uses CW shells and CCW holes.
        canonical = normalize(MultiPolygon(polygons))
        polygons = [orient(polygon, sign=-1.0) for polygon in canonical.geoms]
        result = polygons[0] if len(polygons) == 1 else MultiPolygon(polygons)
        geometry = mapping(result)
        geometry["coordinates"] = rounded_coordinates(geometry["coordinates"])
        if not shape(geometry).is_valid:
            raise ValueError(f"Invalid rounded coastal geometry: {iso}")
        feature["geometry"] = geometry

    article["sources"] = SOURCE
    serialized = json.dumps(article, ensure_ascii=False, separators=(",", ":"))
    TARGET.write_bytes((serialized + "\n").encode("utf-8"))
    print(f"Updated {len(COASTAL)} coastal regions; preserved 20 inland geometries and all properties")
    print(f"Repaired {repaired_count}/{len(land_polygons)} rounded OSM land polygons")


if __name__ == "__main__":
    main()
