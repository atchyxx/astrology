// ホロスコープ計算（天体位置・ハウス・アスペクト）
// ブラウザでは window.Astronomy、Node.js では require('astronomy-engine') を使う
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('astronomy-engine'));
  } else {
    root.HoroscopeCalc = factory(root.Astronomy);
  }
})(typeof self !== 'undefined' ? self : this, function (Astronomy) {
  const DEG = Math.PI / 180;

  const SIGNS = [
    { name: '牡羊座', symbol: '♈', element: '火', mode: '活動' },
    { name: '牡牛座', symbol: '♉', element: '地', mode: '不動' },
    { name: '双子座', symbol: '♊', element: '風', mode: '柔軟' },
    { name: '蟹座',   symbol: '♋', element: '水', mode: '活動' },
    { name: '獅子座', symbol: '♌', element: '火', mode: '不動' },
    { name: '乙女座', symbol: '♍', element: '地', mode: '柔軟' },
    { name: '天秤座', symbol: '♎', element: '風', mode: '活動' },
    { name: '蠍座',   symbol: '♏', element: '水', mode: '不動' },
    { name: '射手座', symbol: '♐', element: '火', mode: '柔軟' },
    { name: '山羊座', symbol: '♑', element: '地', mode: '活動' },
    { name: '水瓶座', symbol: '♒', element: '風', mode: '不動' },
    { name: '魚座',   symbol: '♓', element: '水', mode: '柔軟' },
  ];

  const PLANETS = [
    { key: 'Sun',     name: '太陽',   symbol: '☉' },
    { key: 'Moon',    name: '月',     symbol: '☽' },
    { key: 'Mercury', name: '水星',   symbol: '☿' },
    { key: 'Venus',   name: '金星',   symbol: '♀' },
    { key: 'Mars',    name: '火星',   symbol: '♂' },
    { key: 'Jupiter', name: '木星',   symbol: '♃' },
    { key: 'Saturn',  name: '土星',   symbol: '♄' },
    { key: 'Uranus',  name: '天王星', symbol: '♅' },
    { key: 'Neptune', name: '海王星', symbol: '♆' },
    { key: 'Pluto',   name: '冥王星', symbol: '♇' },
  ];

  const ASPECTS = [
    { angle: 0,   name: 'コンジャンクション', short: '合',   symbol: '☌', orb: 8 },
    { angle: 60,  name: 'セクスタイル',       short: '60°',  symbol: '⚹', orb: 4 },
    { angle: 90,  name: 'スクエア',           short: '90°',  symbol: '□', orb: 6 },
    { angle: 120, name: 'トライン',           short: '120°', symbol: '△', orb: 6 },
    { angle: 180, name: 'オポジション',       short: '180°', symbol: '☍', orb: 8 },
  ];

  function norm360(x) {
    return ((x % 360) + 360) % 360;
  }

  // 黄経 → サインと度分
  function toSign(lon) {
    const l = norm360(lon);
    const index = Math.floor(l / 30);
    const inSign = l - index * 30;
    let deg = Math.floor(inSign);
    let min = Math.round((inSign - deg) * 60);
    if (min === 60) { deg += 1; min = 0; }
    return { index, sign: SIGNS[index], deg, min };
  }

  function planetLongitude(key, time) {
    if (key === 'Moon') return Astronomy.EclipticGeoMoon(time).lon;
    const vec = Astronomy.GeoVector(Astronomy.Body[key], time, true);
    return Astronomy.Ecliptic(vec).elon;
  }

  // 1日あたりの移動量（負なら逆行）
  function dailyMotion(key, time) {
    const before = planetLongitude(key, time.AddDays(-0.5));
    const after = planetLongitude(key, time.AddDays(0.5));
    let d = after - before;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  // 平均ドラゴンヘッド（月の昇交点）
  function meanNode(time) {
    const T = time.tt / 36525;
    return norm360(125.04452 - 1934.136261 * T + 0.0020708 * T * T + T * T * T / 450000);
  }

  // 赤経 → 黄道上の黄経
  function raToLon(ra, eps) {
    return norm360(Math.atan2(Math.sin(ra * DEG), Math.cos(ra * DEG) * Math.cos(eps * DEG)) / DEG);
  }

  function calcAngles(ramc, eps, lat) {
    const r = ramc * DEG, e = eps * DEG, f = lat * DEG;
    const mc = norm360(Math.atan2(Math.sin(r), Math.cos(r) * Math.cos(e)) / DEG);
    const asc = norm360(Math.atan2(Math.cos(r), -(Math.sin(r) * Math.cos(e) + Math.tan(f) * Math.sin(e))) / DEG);
    return { asc, mc };
  }

  // プラシーダス法の中間カスプ（反復計算）
  function placidusCusp(ramc, eps, lat, fraction, aboveHorizon) {
    let ra = ramc + (aboveHorizon ? fraction * 90 : 180 - fraction * 90);
    for (let i = 0; i < 100; i++) {
      const lon = raToLon(ra, eps);
      const decl = Math.asin(Math.sin(eps * DEG) * Math.sin(lon * DEG));
      const ad = Math.asin(Math.tan(lat * DEG) * Math.tan(decl)) / DEG;
      const next = aboveHorizon
        ? ramc + fraction * (90 + ad)
        : ramc + 180 - fraction * (90 - ad);
      if (Math.abs(next - ra) < 1e-9) { ra = next; break; }
      ra = next;
    }
    return raToLon(ra, eps);
  }

  function calcHouses(system, ramc, eps, lat) {
    const { asc, mc } = calcAngles(ramc, eps, lat);
    const cusps = new Array(12);
    let usedSystem = system;

    if (system === 'placidus' && Math.abs(lat) >= 66) usedSystem = 'equal';

    if (usedSystem === 'placidus') {
      cusps[0] = asc;
      cusps[9] = mc;
      cusps[10] = placidusCusp(ramc, eps, lat, 1 / 3, true);
      cusps[11] = placidusCusp(ramc, eps, lat, 2 / 3, true);
      cusps[1] = placidusCusp(ramc, eps, lat, 2 / 3, false);
      cusps[2] = placidusCusp(ramc, eps, lat, 1 / 3, false);
      [3, 4, 5, 6, 7, 8].forEach(i => { cusps[i] = norm360(cusps[(i + 6) % 12] + 180); });
    } else if (usedSystem === 'whole') {
      const start = Math.floor(asc / 30) * 30;
      for (let i = 0; i < 12; i++) cusps[i] = norm360(start + i * 30);
    } else {
      for (let i = 0; i < 12; i++) cusps[i] = norm360(asc + i * 30);
    }
    return { asc, mc, cusps, usedSystem };
  }

  function houseOf(lon, cusps) {
    for (let i = 0; i < 12; i++) {
      const start = cusps[i];
      const width = norm360(cusps[(i + 1) % 12] - start);
      if (norm360(lon - start) < width) return i + 1;
    }
    return 1;
  }

  function findAspect(lonA, lonB) {
    let diff = Math.abs(norm360(lonA - lonB));
    if (diff > 180) diff = 360 - diff;
    for (const asp of ASPECTS) {
      const orb = Math.abs(diff - asp.angle);
      if (orb <= asp.orb) return { aspect: asp, orb };
    }
    return null;
  }

  /**
   * @param {object} input
   *   year, month, day, hour, minute: 現地時刻
   *   tzOffset: UTCからの時差（時間）
   *   lat, lon: 出生地の緯度・経度（東経・北緯を正）
   *   timeKnown: false なら正午で計算し、ハウス・ASC・MC は出さない
   *   houseSystem: 'placidus' | 'equal' | 'whole'
   */
  function calculate(input) {
    const hour = input.timeKnown ? input.hour : 12;
    const minute = input.timeKnown ? input.minute : 0;
    const utcMs = Date.UTC(input.year, input.month - 1, input.day, hour, minute) - input.tzOffset * 3600000;
    const time = Astronomy.MakeTime(new Date(utcMs));

    const eps = Astronomy.e_tilt(time).tobl;
    const ramc = norm360(Astronomy.SiderealTime(time) * 15 + input.lon);

    const houses = input.timeKnown ? calcHouses(input.houseSystem, ramc, eps, input.lat) : null;

    const points = PLANETS.map(p => {
      const lon = norm360(planetLongitude(p.key, time));
      const speed = dailyMotion(p.key, time);
      return { ...p, lon, speed, retrograde: speed < 0 };
    });
    points.push({ key: 'Node', name: 'ドラゴンヘッド', symbol: '☊', lon: meanNode(time), speed: null, retrograde: true });

    if (houses) {
      points.forEach(p => { p.house = houseOf(p.lon, houses.cusps); });
      points.push({ key: 'ASC', name: 'アセンダント', symbol: 'ASC', lon: houses.asc, speed: null, retrograde: false, house: 1 });
      points.push({ key: 'MC', name: 'MC（天頂）', symbol: 'MC', lon: houses.mc, speed: null, retrograde: false, house: 10 });
    }
    points.forEach(p => { p.position = toSign(p.lon); });

    const aspects = [];
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (points[i].key === 'ASC' && points[j].key === 'MC') continue;
        const found = findAspect(points[i].lon, points[j].lon);
        if (found) aspects.push({ a: points[i].key, b: points[j].key, ...found });
      }
    }

    // エレメント・クオリティ集計は太陽〜冥王星の10天体で数える
    const elements = { 火: [], 地: [], 風: [], 水: [] };
    const modes = { 活動: [], 不動: [], 柔軟: [] };
    points.filter(p => PLANETS.some(pl => pl.key === p.key)).forEach(p => {
      elements[p.position.sign.element].push(p.symbol);
      modes[p.position.sign.mode].push(p.symbol);
    });

    return {
      utc: new Date(utcMs),
      julianDayUT: time.ut + 2451545.0,
      lst: ramc / 15,
      obliquity: eps,
      points,
      houses,
      aspects,
      elements,
      modes,
    };
  }

  // 指定した瞬間（UTCミリ秒）の天体の黄経
  function longitudeAt(key, utcMs) {
    return norm360(planetLongitude(key, Astronomy.MakeTime(new Date(utcMs))));
  }

  return { SIGNS, PLANETS, ASPECTS, calculate, toSign, norm360, longitudeAt };
});
