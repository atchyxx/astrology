// 円形ホロスコープ（SVG）の描画
const HoroscopeWheel = (function () {
  const SIZE = 600;
  const C = SIZE / 2;
  const R_OUTER = 290;   // 外周
  const R_SIGN = 250;    // サイン帯の内側

  // 一重円と二重円（内側：出生図、外側：今日の星）の半径
  const SINGLE = { planet: 212, degree: 186, house: 150, inner: 120 };
  const DOUBLE = { transitRing: 200, transit: 230, transitDegree: 210, planet: 178, degree: 156, house: 130, inner: 104 };

  const ELEMENT_FILL = { 火: '#fde8e8', 地: '#e6f4ea', 風: '#fdf6e3', 水: '#e6f0fb' };
  const ELEMENT_TEXT = { 火: '#c53030', 地: '#2f855a', 風: '#b7791f', 水: '#2b6cb0' };
  const TRANSIT_COLOR = '#6b46c1';
  const ASPECT_STYLE = {
    0:   null,
    60:  { color: '#3182ce', dash: '4 3' },
    90:  { color: '#e53e3e', dash: '' },
    120: { color: '#38a169', dash: '' },
    180: { color: '#dd6b20', dash: '' },
  };
  // 絵文字表示を避けてテキスト字形で描くための異体字セレクタ
  const TEXT_STYLE = '︎';
  const MIN_GAP = 8; // 天体記号どうしの最小間隔（度）
  const TRANSIT_ORB = 3; // 二重円で線を引く、今日の星と出生図のアスペクトのオーブ

  function round(n) {
    return Math.round(n * 100) / 100;
  }

  function makeProjector(ascLon) {
    // ASC を左（9時の方向）に置き、黄経は反時計回りに増える
    return (lon, r) => {
      const a = (180 + lon - ascLon) * Math.PI / 180;
      return [round(C + r * Math.cos(a)), round(C - r * Math.sin(a))];
    };
  }

  function line(p1, p2, attrs) {
    return `<line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" ${attrs}/>`;
  }

  function text(p, content, attrs) {
    return `<text x="${p[0]}" y="${p[1]}" text-anchor="middle" dominant-baseline="central" ${attrs}>${content}</text>`;
  }

  function circle(r, attrs) {
    return `<circle cx="${C}" cy="${C}" r="${r}" ${attrs}/>`;
  }

  function sector(at, lon1, lon2, r1, r2, fill) {
    const [a, b, c, d] = [at(lon1, r2), at(lon2, r2), at(lon2, r1), at(lon1, r1)];
    // 黄経の増加方向は画面上で反時計回り（SVG の sweep-flag=0）
    return `<path d="M${a[0]} ${a[1]} A${r2} ${r2} 0 0 0 ${b[0]} ${b[1]} L${c[0]} ${c[1]} A${r1} ${r1} 0 0 1 ${d[0]} ${d[1]} Z" fill="${fill}" stroke="#a0aec0" stroke-width="0.8"/>`;
  }

  function separation(a, b) {
    const d = Math.abs(HoroscopeCalc.norm360(a - b));
    return d > 180 ? 360 - d : d;
  }

  // 記号が重ならないよう表示位置をずらす
  function spread(points) {
    const items = points
      .map(p => ({ p, pos: p.lon }))
      .sort((a, b) => a.pos - b.pos);
    const n = items.length;
    if (n < 2) return items;
    for (let iter = 0; iter < 100; iter++) {
      let moved = false;
      for (let i = 0; i < n; i++) {
        const cur = items[i];
        const next = items[(i + 1) % n];
        let gap = next.pos - cur.pos;
        if (i === n - 1) gap += 360;
        if (gap < MIN_GAP) {
          const push = (MIN_GAP - gap) / 2;
          cur.pos -= push;
          next.pos += push;
          moved = true;
        }
      }
      if (!moved) break;
    }
    return items;
  }

  // 天体記号・度数・目盛りを描く
  function drawBodies(parts, at, points, r) {
    const { toSign } = HoroscopeCalc;
    spread(points.filter(p => p.key !== 'ASC' && p.key !== 'MC')).forEach(({ p, pos }) => {
      const sign = toSign(p.lon);
      const color = r.color || ELEMENT_TEXT[sign.sign.element];
      const retro = p.retrograde && p.speed !== null;
      parts.push(line(at(p.lon, r.tickFrom), at(p.lon, r.tickFrom - 10), `stroke="${r.color || '#2d3748'}" stroke-width="1.5"`));
      parts.push(line(at(p.lon, r.tickFrom - 10), at(pos, r.planet + 13), 'stroke="#a0aec0" stroke-width="0.7"'));
      parts.push(`<g><title>${r.prefix || ''}${p.name} ${sign.sign.name}${sign.deg}°${String(sign.min).padStart(2, '0')}′${retro ? '（逆行）' : ''}</title>` +
        text(at(pos, r.planet), p.symbol + TEXT_STYLE, `font-size="${r.size}" fill="${color}"`) + '</g>');
      parts.push(text(at(pos, r.degree), `${sign.deg}°${retro ? 'R' : ''}`, `font-size="${r.size > 20 ? 11 : 10}" fill="${r.color || '#4a5568'}"`));
    });
  }

  /**
   * @param {object} data   中心に描くチャート（HoroscopeCalc.calculate の結果）
   * @param {object} [outer] 外側に重ねる今日の星（二重円にするとき）
   */
  function render(data, outer) {
    const { SIGNS } = HoroscopeCalc;
    const houses = data.houses;
    const at = makeProjector(houses ? houses.asc : 0);
    const R = outer ? DOUBLE : SINGLE;
    const natalTop = outer ? R.transitRing : R_SIGN;
    const parts = [];

    parts.push(circle(R_OUTER, 'fill="white" stroke="#4a5568" stroke-width="1.5"'));

    // サイン帯
    SIGNS.forEach((s, i) => {
      parts.push(sector(at, i * 30, i * 30 + 30, R_SIGN, R_OUTER, ELEMENT_FILL[s.element]));
      parts.push(text(at(i * 30 + 15, (R_SIGN + R_OUTER) / 2), s.symbol + TEXT_STYLE,
        `font-size="24" fill="${ELEMENT_TEXT[s.element]}"`));
    });

    // 目盛り（1°・5°・10°）
    for (let d = 0; d < 360; d++) {
      const len = d % 10 === 0 ? 10 : d % 5 === 0 ? 6 : 3;
      parts.push(line(at(d, R_SIGN), at(d, R_SIGN - len), 'stroke="#a0aec0" stroke-width="0.6"'));
    }

    parts.push(circle(R_SIGN, 'fill="none" stroke="#4a5568" stroke-width="1.2"'));
    if (outer) parts.push(circle(R.transitRing, `fill="#faf5ff" fill-opacity="0.5" stroke="${TRANSIT_COLOR}" stroke-width="1"`));
    parts.push(circle(R.house, 'fill="none" stroke="#cbd5e0" stroke-width="1"'));
    parts.push(circle(R.inner, 'fill="#f7fafc" stroke="#4a5568" stroke-width="1.2"'));

    // ハウス
    if (houses) {
      houses.cusps.forEach((cusp, i) => {
        const angular = i % 3 === 0;
        parts.push(line(at(cusp, natalTop), at(cusp, R.inner),
          `stroke="${angular ? '#2d3748' : '#a0aec0'}" stroke-width="${angular ? 2 : 1}"`));
        const next = houses.cusps[(i + 1) % 12];
        const mid = cusp + HoroscopeCalc.norm360(next - cusp) / 2;
        parts.push(text(at(mid, (R.inner + R.house) / 2), i + 1, 'font-size="13" fill="#718096"'));
      });
      [['ASC', houses.asc], ['DSC', houses.asc + 180], ['MC', houses.mc], ['IC', houses.mc + 180]].forEach(([label, lon]) => {
        parts.push(text(at(lon + 3.5, natalTop - 14), label, 'font-size="11" font-weight="700" fill="#2d3748"'));
      });
    }

    // アスペクト線：一重円は天体どうし、二重円は今日の星と出生図の天体
    const planetKeys = new Set(HoroscopeCalc.PLANETS.map(p => p.key));
    if (outer) {
      outer.points.filter(t => planetKeys.has(t.key)).forEach(t => {
        data.points.filter(n => planetKeys.has(n.key)).forEach(n => {
          const sep = separation(t.lon, n.lon);
          HoroscopeCalc.ASPECTS.forEach(asp => {
            const style = ASPECT_STYLE[asp.angle];
            if (!style || Math.abs(sep - asp.angle) > TRANSIT_ORB) return;
            parts.push(line(at(t.lon, R.inner), at(n.lon, R.inner),
              `stroke="${style.color}" stroke-width="1.3" ${style.dash ? `stroke-dasharray="${style.dash}"` : ''} opacity="0.85"`));
          });
        });
      });
    } else {
      const lonOf = {};
      data.points.forEach(p => { lonOf[p.key] = p.lon; });
      data.aspects.forEach(a => {
        const style = ASPECT_STYLE[a.aspect.angle];
        if (!style || !planetKeys.has(a.a) || !planetKeys.has(a.b)) return;
        parts.push(line(at(lonOf[a.a], R.inner), at(lonOf[a.b], R.inner),
          `stroke="${style.color}" stroke-width="1.3" ${style.dash ? `stroke-dasharray="${style.dash}"` : ''} opacity="0.85"`));
      });
    }

    // 中心のチャートの天体
    drawBodies(parts, at, data.points, { tickFrom: natalTop, planet: R.planet, degree: R.degree, size: outer ? 19 : 22 });
    data.points.filter(p => p.key !== 'ASC' && p.key !== 'MC').forEach(p => {
      parts.push(line(at(p.lon, R.inner), at(p.lon, R.inner + 6), 'stroke="#2d3748" stroke-width="1.2"'));
    });

    // 外側の今日の星
    if (outer) {
      drawBodies(parts, at, outer.points.filter(p => p.key !== 'Node'),
        { tickFrom: R_SIGN, planet: R.transit, degree: R.transitDegree, size: 17, color: TRANSIT_COLOR, prefix: '今日の' });
    }

    return `<svg viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ホロスコープ円形チャート" class="wheel-svg">${parts.join('')}</svg>`;
  }

  return { render };
})();
