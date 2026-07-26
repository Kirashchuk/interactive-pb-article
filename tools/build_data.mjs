#!/usr/bin/env node
/**
 * build_data.mjs — експорт даних для інтерактивного лонгріда.
 *
 * Читає CSV з "../Аналітика Бюджетів участі/TECH data/" та сирий GeoJSON
 * областей (geoBoundaries UKR ADM1, tools/raw/), пише:
 *   data/pb_data.json        — міста, показники місто-рік, річні агрегати
 *   data/ukraine_oblasts.geojson — області зі зменшеною точністю координат
 *
 * Запуск (з кореня репозиторію або з interactive-pb-article/):
 *   node interactive-pb-article/tools/build_data.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(__dirname, '..');
const DATA_DIR = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(PROJECT, '..', 'Аналітика Бюджетів участі', 'TECH data');

// ---------------------------------------------------------------- CSV parser
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
}

function readCSV(file) {
  const text = fs.readFileSync(path.join(DATA_DIR, file), 'utf8').replace(/^﻿/, '');
  const [header, ...rows] = parseCSV(text);
  return rows.map(r => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

// Уніфікація апострофів у назвах міст (у файлах трапляються ’ та ')
const normName = s => s.replace(/[’ʼ`]/g, "'").trim();

// ------------------------------------------------- довідники: координати, ISO
// Координати міст (WGS84), джерело — загальновідомі геодані населених пунктів.
const CITY_COORDS = {
  'Алчевськ': [38.798, 48.467], 'Бердянськ': [36.799, 46.756], "Біла Церква": [30.117, 49.796],
  'Бровари': [30.790, 50.511], 'Вінниця': [28.468, 49.233], 'Горлівка': [38.037, 48.336],
  'Дніпро': [35.046, 48.464], 'Донецьк': [37.802, 48.015], 'Житомир': [28.658, 50.254],
  'Запоріжжя': [35.139, 47.838], 'Івано-Франківськ': [24.711, 48.922], "Кам'янське": [34.602, 48.511],
  'Київ': [30.523, 50.450], 'Краматорськ': [37.584, 48.739], 'Кременчук': [33.420, 49.068],
  'Кривий Ріг': [33.392, 47.910], 'Кропивницький': [32.262, 48.507], 'Луганськ': [39.307, 48.574],
  'Луцьк': [25.325, 50.747], 'Львів': [24.031, 49.842], 'Макіївка': [37.926, 48.048],
  'Маріуполь': [37.543, 47.097], 'Мелітополь': [35.365, 46.848], 'Миколаїв': [31.995, 46.975],
  'Нікополь': [34.396, 47.567], 'Одеса': [30.723, 46.482], 'Павлоград': [35.870, 48.520],
  'Полтава': [34.551, 49.589], 'Рівне': [26.251, 50.620], "Слов'янськ": [37.598, 48.854],
  'Суми': [34.798, 50.907], 'Тернопіль': [25.594, 49.553], 'Ужгород': [22.288, 48.621],
  'Харків': [36.231, 49.994], 'Херсон': [32.617, 46.635], 'Хмельницький': [26.987, 49.423],
  'Черкаси': [32.060, 49.444], 'Чернівці': [25.935, 48.292], 'Чернігів': [31.294, 51.494],
};

// Область (як у CSV) → ISO 3166-2 (як у geoBoundaries shapeISO)
const REGION_ISO = {
  'Вінницька область': 'UA-05', 'Волинська область': 'UA-07', 'Луганська область': 'UA-09',
  'Дніпропетровська область': 'UA-12', 'Донецька область': 'UA-14', 'Житомирська область': 'UA-18',
  'Закарпатська область': 'UA-21', 'Запорізька область': 'UA-23', 'Івано-Франківська область': 'UA-26',
  'м. Київ': 'UA-30', 'Київська область': 'UA-32', 'Кіровоградська область': 'UA-35',
  'Львівська область': 'UA-46', 'Миколаївська область': 'UA-48', 'Одеська область': 'UA-51',
  'Полтавська область': 'UA-53', 'Рівненська область': 'UA-56', 'Сумська область': 'UA-59',
  'Тернопільська область': 'UA-61', 'Харківська область': 'UA-63', 'Херсонська область': 'UA-65',
  'Хмельницька область': 'UA-68', 'Черкаська область': 'UA-71', 'Чернігівська область': 'UA-74',
  'Чернівецька область': 'UA-77',
};

// ISO → українська назва для підписів на карті (всі 27 одиниць ADM1)
const ISO_UA_NAME = {
  'UA-05': 'Вінницька обл.', 'UA-07': 'Волинська обл.', 'UA-09': 'Луганська обл.',
  'UA-12': 'Дніпропетровська обл.', 'UA-14': 'Донецька обл.', 'UA-18': 'Житомирська обл.',
  'UA-21': 'Закарпатська обл.', 'UA-23': 'Запорізька обл.', 'UA-26': 'Івано-Франківська обл.',
  'UA-30': 'м. Київ', 'UA-32': 'Київська обл.', 'UA-35': 'Кіровоградська обл.',
  'UA-40': 'м. Севастополь', 'UA-43': 'АР Крим', 'UA-46': 'Львівська обл.',
  'UA-48': 'Миколаївська обл.', 'UA-51': 'Одеська обл.', 'UA-53': 'Полтавська обл.',
  'UA-56': 'Рівненська обл.', 'UA-59': 'Сумська обл.', 'UA-61': 'Тернопільська обл.',
  'UA-63': 'Харківська обл.', 'UA-65': 'Херсонська обл.', 'UA-68': 'Хмельницька обл.',
  'UA-71': 'Черкаська обл.', 'UA-74': 'Чернігівська обл.', 'UA-77': 'Чернівецька обл.',
};

const EXCLUDED_ISO = ['UA-40', 'UA-43']; // Крим і Севастополь — поза рамкою дослідження

// ---------------------------------------------------------------- читання CSV
const YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021];
const rowsCY = readCSV('city_year_normalized.csv');
const rowsCoverage = readCSV('coverage_summary.csv');

const num = s => (s === '' || s == null ? null : Number(s));

const coverageByCity = new Map(rowsCoverage.map(r => [normName(r.city), r]));

const citiesMap = new Map();
for (const r of rowsCY) {
  const name = normName(r.city);
  const year = Number(r.year);
  if (!YEARS.includes(year)) continue;

  if (!citiesMap.has(name)) {
    const coords = CITY_COORDS[name];
    if (!coords) throw new Error(`Немає координат для міста: ${name}`);
    const iso = REGION_ISO[r.region];
    if (!iso) throw new Error(`Немає ISO для області: ${r.region}`);
    const cov = coverageByCity.get(name) || {};
    citiesMap.set(name, {
      name,
      region: r.region,
      iso,
      lon: coords[0],
      lat: coords[1],
      population: num(r.population_2022_01_01),
      tot: r.territory_flag.includes('ТОТ'),
      firstYear: num(r.first_pb_year),
      coverageAnyPct: num(cov.coverage_any_metric_pct),
      years: {},
    });
  }

  const applications = num(r.applications_count);
  const winners = num(r.winners_count);
  const amount = num(r.allocated_amount_uah);
  const city = citiesMap.get(name);

  // Статус клітинки: порожньо ≠ нуль — розрізняємо стани явно
  let status;
  if (city.tot) status = 'tot';                                  // ТОТ до 24.02.2022
  else if (r.completeness_status === 'not_applicable') status = 'pre'; // до першого циклу
  else if (applications == null && winners == null && amount == null) status = 'nodata';
  else status = 'data';

  city.years[year] = {
    a: applications,
    w: winners,
    s: amount,
    status,
    basis: r.amount_basis || null,       // основа суми — не усереднювати різні основи
    completeness: r.completeness_status || null,
    confidence: r.confidence || null,
  };
}

const cities = [...citiesMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'uk'));

// ------------------------------------------------------------- річні агрегати
const totals = {};
for (const y of YEARS) {
  let activeCities = 0, applications = 0, winners = 0, amount = 0;
  let citiesWithAmount = 0;
  for (const c of cities) {
    const d = c.years[y];
    if (!d) continue;
    const active = d.a != null || d.w != null || d.s != null;
    if (active) activeCities++;
    if (d.a != null) applications += d.a;
    if (d.w != null) winners += d.w;
    if (d.s != null) { amount += d.s; citiesWithAmount++; }
  }
  totals[y] = { activeCities, applications, winners, amount, citiesWithAmount };
}

// Контрольні значення з аналітичної матриці (аркуш «Матриця»)
const CANON = {
  2015: { c: 2,  a: 127,  w: 23,   s: 4.8e6  },
  2016: { c: 20, a: 2398, w: 419,  s: 159e6  },
  2017: { c: 27, a: 3834, w: 659,  s: 425e6  },
  2018: { c: 31, a: 4008, w: 1049, s: 559e6  },
  2019: { c: 30, a: 5172, w: 1166, s: 519e6  },
  2020: { c: 29, a: 4820, w: 1097, s: 610e6  },
  2021: { c: 30, a: 4351, w: 1194, s: 641e6  },
};
console.log('Перевірка агрегатів (обчислено ← → контроль з «Матриці»):');
for (const y of YEARS) {
  const t = totals[y], k = CANON[y];
  const близько = (x, ref, tol) => Math.abs(x - ref) <= tol;
  const ok =
    t.activeCities === k.c && t.applications === k.a && t.winners === k.w &&
    близько(t.amount, k.s, k.s * 0.03 + 2e6);
  console.log(
    `${y}: міст ${t.activeCities}/${k.c}, заявок ${t.applications}/${k.a}, ` +
    `переможців ${t.winners}/${k.w}, сума ${(t.amount / 1e6).toFixed(1)}/${(k.s / 1e6).toFixed(1)} млн — ${ok ? 'OK' : 'РОЗБІЖНІСТЬ'}`
  );
}

// ТОП міст за сумою 2015–2021 — для контролю
const cityTotals = cities
  .map(c => ({
    name: c.name,
    amount: YEARS.reduce((s, y) => s + (c.years[y]?.s ?? 0), 0),
  }))
  .sort((a, b) => b.amount - a.amount);
console.log('\nТОП-6 за сумою 2015–2021:');
cityTotals.slice(0, 6).forEach(c => console.log(`  ${c.name}: ${(c.amount / 1e6).toFixed(0)} млн грн`));

// ------------------------------------------------------------------ GeoJSON
const rawGeo = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'raw', 'ukraine_adm1_geoboundaries.geojson'), 'utf8')
);
const roundCoords = c =>
  typeof c[0] === 'number' ? c.map(v => Math.round(v * 1000) / 1000) : c.map(roundCoords);

// d3-geo використовує сферичний обхід: зовнішні кільця — за годинниковою
// стрілкою (у планарних lon/lat — відʼємна площа за формулою шнурівки),
// інакше полігон читається як «весь світ мінус область». RFC 7946 (geoBoundaries)
// має протилежний порядок, тому кільця перемотуємо.
const shoelace = ring => {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += (ring[i + 1][0] - ring[i][0]) * (ring[i + 1][1] + ring[i][1]);
  }
  return a; // > 0 — за годинниковою (CW), < 0 — проти (CCW)
};
const rewindPolygon = rings =>
  rings.map((ring, i) => {
    const cw = shoelace(ring) > 0;
    const wantCW = i === 0;          // зовнішнє кільце CW, отвори CCW
    return cw === wantCW ? ring : [...ring].reverse();
  });
const rewind = geom =>
  geom.type === 'Polygon'
    ? { ...geom, coordinates: rewindPolygon(geom.coordinates) }
    : { ...geom, coordinates: geom.coordinates.map(rewindPolygon) };
const geo = {
  type: 'FeatureCollection',
  features: rawGeo.features.map(f => ({
    type: 'Feature',
    properties: {
      iso: f.properties.shapeISO,
      name: ISO_UA_NAME[f.properties.shapeISO] || f.properties.shapeName,
      excluded: EXCLUDED_ISO.includes(f.properties.shapeISO),
    },
    geometry: rewind({ type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates) }),
  })),
};

// -------------------------------------------------------------------- запис
const out = {
  meta: {
    title: 'Бюджети участі великих міст України, 2015–2021',
    generated: new Date().toISOString().slice(0, 10),
    frame: '39 міст з населенням понад 100 тис. осіб (без Криму і Севастополя); дані наявні для 34 міст',
    caveats: [
      'Порожня клітинка не дорівнює нулю: відсутність даних позначено окремими станами.',
      'Суми мають різні основи (річний ліміт програми або сума бюджетів проєктів-переможців) — їх не можна усереднювати між містами.',
      "5 міст на ТОТ до 24.02.2022 (Алчевськ, Горлівка, Донецьк, Луганськ, Макіївка) — стан «немає даних».",
    ],
  },
  years: YEARS,
  totals,
  cities,
  cityTotals: cityTotals.filter(c => c.amount > 0),
};

fs.writeFileSync(path.join(PROJECT, 'data', 'pb_data.json'), JSON.stringify(out), 'utf8');
fs.writeFileSync(path.join(PROJECT, 'data', 'ukraine_oblasts.geojson'), JSON.stringify(geo), 'utf8');

console.log(`\nЗаписано data/pb_data.json (${cities.length} міст) і data/ukraine_oblasts.geojson (${geo.features.length} регіонів).`);
