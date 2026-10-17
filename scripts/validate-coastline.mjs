import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const readJson = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const [geo, raw, data, vendor] = await Promise.all([
  readJson(process.argv[2] || 'data/ukraine_oblasts.geojson'),
  readJson('tools/raw/ukraine_adm1_geoboundaries.geojson'),
  readJson('data/pb_data.json'),
  readFile(resolve(root, 'vendor/d3.v7.min.js'), 'utf8'),
]);
const context = vm.createContext({});
vm.runInContext(vendor, context);
const d3 = context.d3;
const coastal = new Set(['UA-65', 'UA-14', 'UA-23', 'UA-51', 'UA-48', 'UA-43', 'UA-40']);
const expectedIsos = [
  'UA-05', 'UA-07', 'UA-09', 'UA-12', 'UA-14', 'UA-18', 'UA-21',
  'UA-23', 'UA-26', 'UA-30', 'UA-32', 'UA-35', 'UA-40', 'UA-43',
  'UA-46', 'UA-48', 'UA-51', 'UA-53', 'UA-56', 'UA-59', 'UA-61',
  'UA-63', 'UA-65', 'UA-68', 'UA-71', 'UA-74', 'UA-77',
];
assert.equal(geo.type, 'FeatureCollection');
assert.equal(geo.features.length, 27, 'All 27 Ukrainian ADM1 regions must remain');
assert.deepEqual(geo.features.map(f => f.properties.iso).sort(), expectedIsos);
const byIso = new Map(geo.features.map(f => [f.properties.iso, f]));
const signedArea = ring => ring.slice(1).reduce((sum, point, i) =>
  sum + ring[i][0] * point[1] - point[0] * ring[i][1], 0) / 2;
const roundOriginal = coordinates => typeof coordinates[0] === 'number'
  ? coordinates.map(n => Math.round(n * 1000) / 1000)
  : coordinates.map(roundOriginal);
const rewindOriginal = rings => rings.map((ring, i) =>
  (signedArea(ring) < 0) === (i === 0) ? ring : [...ring].reverse());

for (const feature of geo.features) {
  const { iso, name, excluded } = feature.properties;
  assert.equal(typeof name, 'string', `${iso}: retain region name`);
  assert.ok(name.length > 0, `${iso}: nonempty name`);
  assert.equal(excluded, iso === 'UA-43' || iso === 'UA-40', `${iso}: excluded flag`);
  const geometry = feature.geometry;
  assert.ok(['Polygon', 'MultiPolygon'].includes(geometry.type), `${iso}: polygon geometry`);
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  assert.ok(polygons.length > 0, `${iso}: land must remain`);
  for (const rings of polygons) {
    for (const [index, ring] of rings.entries()) {
      assert.ok(ring.length >= 4, `${iso}: nondegenerate ring`);
      assert.deepEqual(ring[0], ring.at(-1), `${iso}: closed ring`);
      assert.ok(index === 0 ? signedArea(ring) < 0 : signedArea(ring) > 0,
        `${iso}: D3 requires clockwise exterior and counterclockwise holes`);
      for (const point of ring) {
        assert.equal(point.length, 2);
        assert.ok(point.every(Number.isFinite), `${iso}: finite coordinates`);
        assert.ok(point[0] >= 22 && point[0] <= 41 && point[1] >= 44 && point[1] <= 53,
          `${iso}: coordinates must remain in Ukraine's bounds`);
        assert.ok(point.every(n => Math.abs(n * 1e5 - Math.round(n * 1e5)) < 1e-7),
          `${iso}: coordinates must use at most five decimal places`);
      }
    }
  }
  const area = d3.geoArea(feature);
  assert.ok(area > 0 && area < 0.01, `${iso}: D3 must see a local region, not its global complement`);
  assert.equal(d3.geoContains(feature, [0, 0]), false, `${iso}: no global complement`);
  if (!coastal.has(iso)) {
    const original = raw.features.find(f => f.properties.shapeISO === iso).geometry;
    const coordinates = roundOriginal(original.coordinates);
    const expected = {
      type: original.type,
      coordinates: original.type === 'Polygon'
        ? rewindOriginal(coordinates) : coordinates.map(rewindOriginal),
    };
    assert.deepEqual(geometry, expected, `${iso}: inland geometry must remain exactly unchanged`);
  }
}

// These points were painted as land by the maritime ADM1 envelopes.
const seaProbes = [
  [33.5, 44.25], [33.5, 44.3], [30.9, 46.3], [30.7, 46.2],
  [31.5, 46.5], [31.6, 46.2], [35.5, 46.2], [36.5, 46.7],
  [32.8, 45.9], [35.4, 44.9], [36.6, 45.3], [36.8, 46.5],
];
for (const point of seaProbes) {
  const containing = geo.features.filter(feature => d3.geoContains(feature, point));
  assert.equal(containing.length, 0,
    `Sea probe ${point} is still painted as ${containing.map(f => f.properties.iso).join(', ')}`);
}

assert.equal(data.cities.length, 35, 'Validate the full study city sample');
for (const city of data.cities) {
  assert.ok(d3.geoContains(byIso.get(city.iso), [city.lon, city.lat]),
    `${city.name}: city center must remain in its own region`);
}
const crimeaLand = [
  ['UA-40', [33.54, 44.6]], // Sevastopol urban land south of the harbor
  ['UA-40', [33.6, 44.7]], // Land east of the Belbek river mouth
  ['UA-43', [34.108, 44.952]], // Simferopol
  ['UA-43', [36.468, 45.357]], // Kerch
  ['UA-43', [34.165, 44.495]], // Yalta
];
for (const [iso, point] of crimeaLand) {
  assert.ok(d3.geoContains(byIso.get(iso), point), `${iso}: Crimean land ${point} must remain`);
}
console.log(`Validated coastline: 27 regions, 20 unchanged inland geometries, ${seaProbes.length} sea probes, 35 city centers and ${crimeaLand.length} Crimean land probes`);
