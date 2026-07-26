# -*- coding: utf-8 -*-
"""
pdf_map.py — статичні карти України для PDF-додатка (reportlab, без matplotlib).

Малює хороплет областей + пропорційні бульбашки міст за обраний рік:
проєкція Albers Equal Area Conic (стандартні паралелі 46,5° і 50,5°),
області з ukraine_oblasts.geojson, міста з pb_data.json.
"""
import math

from reportlab.lib import colors
from reportlab.graphics.shapes import Drawing, Polygon, Circle, String, Group, Rect, Line

# ---- проєкція Albers Equal Area Conic ----
PHI1, PHI2 = math.radians(46.5), math.radians(50.5)
PHI0 = math.radians(48.4)
LAM0 = math.radians(31.2)
_N = (math.sin(PHI1) + math.sin(PHI2)) / 2
_C = math.cos(PHI1) ** 2 + 2 * _N * math.sin(PHI1)
_RHO0 = math.sqrt(_C - 2 * _N * math.sin(PHI0)) / _N


def _project(lon, lat):
    phi, lam = math.radians(lat), math.radians(lon)
    rho = math.sqrt(max(0.0, _C - 2 * _N * math.sin(phi))) / _N
    theta = _N * (lam - LAM0)
    return rho * math.sin(theta), _RHO0 - rho * math.cos(theta)


def _rings(geom):
    """Зовнішні кільця полігонів (отвори ігноруємо — для оглядової карти достатньо)."""
    t, c = geom['type'], geom['coordinates']
    if t == 'Polygon':
        return [c[0]]
    if t == 'MultiPolygon':
        return [poly[0] for poly in c]
    return []


BLUE = colors.HexColor('#2a78d6')
NODATA = colors.HexColor('#b8b6ae')
LAND = colors.HexColor('#eef1f4')
LAND_STROKE = colors.HexColor('#c3c2b7')
EXCL = colors.HexColor('#e2e1db')
INK = colors.HexColor('#1a1a1a')
MUTED = colors.HexColor('#666666')

SEQ = [colors.HexColor(h) for h in
       ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95']]


def _val(city, year):
    d = city['years'].get(str(year)) or city['years'].get(year)
    if not d or d.get('status') != 'data':
        return None
    return d.get('s')


class MapMaker:
    def __init__(self, geo, cities, years, width=470, height=300):
        self.geo, self.cities, self.years = geo, cities, years
        self.W, self.H = width, height
        # межі проєкції за всіма координатами областей
        xs, ys = [], []
        for f in geo['features']:
            for ring in _rings(f['geometry']):
                for lon, lat in ring:
                    x, y = _project(lon, lat)
                    xs.append(x); ys.append(y)
        self.minx, self.maxx = min(xs), max(xs)
        self.miny, self.maxy = min(ys), max(ys)
        pad = 16
        self.scale = min((width - 2 * pad) / (self.maxx - self.minx),
                         (height - 2 * pad) / (self.maxy - self.miny))
        self.offx = pad + (width - 2 * pad - (self.maxx - self.minx) * self.scale) / 2
        self.offy = pad + (height - 2 * pad - (self.maxy - self.miny) * self.scale) / 2
        # глобальний максимум суми (для сталого масштабу бульбашок між роками)
        self.maxsum = max(
            (_val(c, y) or 0) for c in cities for y in years) or 1
        # максимум суми по областях (для хороплету) за всіма роками
        self.oblast_max = 1
        for y in years:
            for v in self._oblast_totals(y).values():
                self.oblast_max = max(self.oblast_max, v)

    def _pt(self, lon, lat):
        x, y = _project(lon, lat)
        px = self.offx + (x - self.minx) * self.scale
        # reportlab: y вгору; північ (більша широта) = більший y — вже так
        py = self.offy + (y - self.miny) * self.scale
        return px, py

    def _oblast_totals(self, year):
        m = {}
        for c in self.cities:
            v = _val(c, year)
            if v is not None:
                m[c['iso']] = m.get(c['iso'], 0) + v
        return m

    def draw(self, year):
        d = Drawing(self.W, self.H)
        totals = self._oblast_totals(year)

        def seq_color(v):
            if not v:
                return LAND
            idx = min(len(SEQ) - 1, int(len(SEQ) * v / self.oblast_max))
            return SEQ[idx]

        # області
        for f in self.geo['features']:
            excl = f['properties'].get('excluded')
            fill = EXCL if excl else seq_color(totals.get(f['properties']['iso']))
            for ring in _rings(f['geometry']):
                pts = []
                for lon, lat in ring:
                    px, py = self._pt(lon, lat)
                    pts += [px, py]
                poly = Polygon(pts)
                poly.fillColor = fill
                poly.strokeColor = LAND_STROKE
                poly.strokeWidth = 0.4
                d.add(poly)

        # бульбашки міст
        labels = []
        for c in self.cities:
            px, py = self._pt(c['lon'], c['lat'])
            v = _val(c, year)
            if v:
                r = max(1.6, math.sqrt(v / self.maxsum) * 20)
                circ = Circle(px, py, r)
                circ.fillColor = BLUE
                try:
                    circ.fillOpacity = 0.72
                except Exception:
                    pass
                circ.strokeColor = colors.white
                circ.strokeWidth = 0.6
                d.add(circ)
                if v > self.maxsum * 0.18:  # підписуємо лише найбільші
                    labels.append((px + r + 1.5, py - 2.5, c['name']))
            else:
                # стан без даних — маленьке порожнє коло
                circ = Circle(px, py, 1.8)
                circ.fillColor = colors.white
                circ.strokeColor = NODATA
                circ.strokeWidth = 0.8
                d.add(circ)

        for lx, ly, name in labels:
            s = String(lx, ly, name, fontName='Times', fontSize=6.2, fillColor=INK)
            d.add(s)

        return d


def legend(width=470, height=20):
    """Легенда під картою."""
    d = Drawing(width, height)
    x = 2
    # бульбашка «місто з даними»
    c = Circle(x + 5, height / 2, 4)
    c.fillColor = BLUE
    try:
        c.fillOpacity = 0.72
    except Exception:
        pass
    c.strokeColor = colors.white
    d.add(c)
    d.add(String(x + 12, height / 2 - 3, 'місто з даними (розмір ∝ сумі)',
                 fontName='Times', fontSize=7.5, fillColor=INK))
    x = 190
    c2 = Circle(x + 5, height / 2, 2)
    c2.fillColor = colors.white
    c2.strokeColor = NODATA
    d.add(c2)
    d.add(String(x + 12, height / 2 - 3, 'немає підтверджених даних',
                 fontName='Times', fontSize=7.5, fillColor=INK))
    x = 340
    r = Rect(x, height / 2 - 4, 10, 8)
    r.fillColor = EXCL
    r.strokeColor = LAND_STROKE
    d.add(r)
    d.add(String(x + 14, height / 2 - 3, 'поза рамкою (Крим, Севастополь)',
                 fontName='Times', fontSize=7.5, fillColor=INK))
    return d
