// 今週の星読み（トランジット）：出生図と1週間の星の動きから、ラッキーな日と注意したい日を出す
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./horoscope-calc.js'), require('astronomy-engine'));
  } else {
    root.HoroscopeForecast = factory(root.HoroscopeCalc, root.Astronomy);
  }
})(typeof self !== 'undefined' ? self : this, function (Calc, Astronomy) {
  const DAY_MS = 86400000;
  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

  // 1日単位で見る天体（これより遅い天体は「今週ずっと続く影響」として扱う）
  const FAST = ['Moon', 'Sun', 'Mercury', 'Venus', 'Mars'];
  const SLOW = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

  // トランジット天体の吉凶の強さ
  const BENEFIC = { Sun: 1, Moon: 0.6, Mercury: 0.6, Venus: 1.5, Mars: 0.6, Jupiter: 2, Saturn: 0.6, Uranus: 0.6, Neptune: 0.6, Pluto: 0.6 };
  const MALEFIC = { Sun: 0.5, Moon: 0.4, Mercury: 0.6, Venus: 0.3, Mars: 1.5, Jupiter: 0.5, Saturn: 2, Uranus: 1.2, Neptune: 1, Pluto: 1.5 };
  const ASPECT_WEIGHT = { 0: 1, 60: 0.8, 90: 1, 120: 1, 180: 0.9 };
  // 出生図のどの点に当たるかの重み
  const NATAL_WEIGHT = { Sun: 1.5, Moon: 1.5, ASC: 1.5, MC: 1.3 };
  const MOON_WEIGHT = 0.6;

  const TRANSIT_TEXT = {
    Sun:     { word: '太陽',   good: '自分から前に出ると評価されやすいとき。', caution: '張り切りすぎや自己主張の強さに気を付けて。' },
    Moon:    { word: '月',     good: '気持ちが安定し、人と打ち解けやすいとき。', caution: '気分の波に流されやすいので、大事な決断は落ち着いてから。' },
    Mercury: { word: '水星',   good: '連絡・勉強・話し合いがスムーズに進みます。', caution: '言い間違い・聞き違い・連絡ミスに注意。送信前に見直しを。' },
    Venus:   { word: '金星',   good: '人との交流や楽しみごとに恵まれます。おしゃれや買い物にも◎。', caution: '甘えや浪費に注意。予定の詰め込みすぎも禁物。' },
    Mars:    { word: '火星',   good: '行動力が高まり、物事を一気に進められます。', caution: '焦り・イライラ・ケガに注意。急がず安全第一で。' },
    Jupiter: { word: '木星',   good: 'チャンスが広がる好機。新しいことを始めるのに向いています。', caution: '楽観しすぎや約束のしすぎに注意。' },
    Saturn:  { word: '土星',   good: '地道な努力が形になります。計画づくりに向く時期。', caution: 'プレッシャーや停滞を感じやすい時期。無理せず一つずつ。' },
    Uranus:  { word: '天王星', good: '思わぬひらめきやうれしい変化がありそう。', caution: '急な予定変更やハプニングに備えて、時間に余裕を。' },
    Neptune: { word: '海王星', good: '直感や想像力がさえます。創作や癒やしの時間に。', caution: '思い込みや確認不足に注意。大事なことは書面で確認を。' },
    Pluto:   { word: '冥王星', good: '深い集中力で、根本から物事を変えられます。', caution: 'こだわりすぎや力づくの対応に注意。' },
  };

  const NATAL_AREA = {
    Sun: 'あなたらしさや目標', Moon: 'あなたの気持ちや家庭', Mercury: 'あなたの考えやコミュニケーション',
    Venus: 'あなたの好きなことや人づきあい', Mars: 'あなたのやる気や行動', Jupiter: 'あなたの成長や可能性',
    Saturn: 'あなたの努力や責任', Uranus: 'あなたの個性や自由', Neptune: 'あなたの夢や想像力', Pluto: 'あなたの心の奥の力',
    ASC: 'あなたの体調や第一印象', MC: 'あなたの仕事や社会での立場',
  };

  const MOON_SIGN_TEXT = [
    '思い立ったらすぐ行動すると吉', 'ゆったり過ごし、五感を満たすと吉', '情報収集やおしゃべりが楽しい',
    '家族や身近な人を大切に', '自分を表現して楽しむと吉', '整理整頓や細かい作業がはかどる',
    '人との調和や美しいものに触れると吉', '一つのことに集中して深く考える', '学びや遠出に向く',
    '計画を立ててコツコツ進める', '仲間との時間や新しいアイデアに◎', '休息や想像力を育てる時間に',
  ];

  const QUARTER_TEXT = [
    { name: '新月', text: '新しい目標を立てたり、始めごとをしたりするのに向いています。' },
    { name: '上弦の月', text: '始めたことを見直し、行動を後押しするタイミング。' },
    { name: '満月', text: 'これまでの成果が見えやすい一方、感情が高ぶりやすい日。' },
    { name: '下弦の月', text: '不要なものを手放し、整理するのに向いています。' },
  ];

  function separation(a, b) {
    const d = Math.abs(Calc.norm360(a - b));
    return d > 180 ? 360 - d : d;
  }

  function aspectScore(transitKey, natalKey, angle) {
    const w = ASPECT_WEIGHT[angle] * (NATAL_WEIGHT[natalKey] || 1) * (transitKey === 'Moon' ? MOON_WEIGHT : 1);
    if (angle === 60 || angle === 120) return BENEFIC[transitKey] * w;
    if (angle === 90 || angle === 180) return -MALEFIC[transitKey] * w;
    return (BENEFIC[transitKey] - MALEFIC[transitKey]) * w;
  }

  function aspectText(transitKey, natal, aspect, score) {
    const t = TRANSIT_TEXT[transitKey];
    const area = NATAL_AREA[natal.key];
    if (score >= 0) return `${t.word}が${area}を後押し。${t.good}`;
    return `${t.word}が${area}に緊張をもたらします。${t.caution}`;
  }

  // 現地日付（tzOffset 時間）を表すオブジェクト
  function localDay(startUtcMs, i, tzOffset) {
    const d = new Date(startUtcMs + i * DAY_MS + tzOffset * 3600000);
    return { month: d.getUTCMonth() + 1, day: d.getUTCDate(), weekday: WEEKDAYS[d.getUTCDay()] };
  }

  // 月のアスペクトが正確になる時刻（現地時刻・時）を推定
  function moonExactHour(natalLon, angle, noonUtcMs) {
    const dev = ms => separation(Calc.longitudeAt('Moon', ms), natalLon) - angle;
    const f0 = dev(noonUtcMs);
    const rate = (dev(noonUtcMs + 3600000) - dev(noonUtcMs - 3600000)) / 2;
    if (Math.abs(rate) < 1e-6) return null;
    const hour = 12 - f0 / rate;
    return hour >= 0 && hour < 24 ? Math.round(hour) : null;
  }

  /**
   * 指定した期間の日ごとの運勢
   * @param {object} natal  HoroscopeCalc.calculate の結果
   * @param {object} opts   year, month, day: 初日（現地）, days: 日数, tzOffset, lat, lon
   */
  function forecast(natal, opts) {
    const n = opts.days;
    const natalPoints = natal.points.filter(p => p.key !== 'Node');
    const startUtcMs = Date.UTC(opts.year, opts.month - 1, opts.day) - opts.tzOffset * 3600000;
    const noonOf = i => startUtcMs + i * DAY_MS + 12 * 3600000;

    // 前日〜翌日までの正午の天体位置（極小判定と逆行・サイン移動の検出用）
    const sky = [];
    for (let i = -1; i <= n; i++) {
      const u = new Date(noonOf(i) + opts.tzOffset * 3600000);
      sky.push(Calc.calculate({
        year: u.getUTCFullYear(), month: u.getUTCMonth() + 1, day: u.getUTCDate(),
        hour: 12, minute: 0, tzOffset: opts.tzOffset, lat: opts.lat, lon: opts.lon,
        timeKnown: false, houseSystem: 'equal',
      }));
    }
    const at = (i, key) => sky[i + 1].points.find(p => p.key === key);

    const days = [];
    for (let i = 0; i < n; i++) {
      const moon = at(i, 'Moon');
      days.push({
        index: i,
        ...localDay(startUtcMs, i, opts.tzOffset),
        moonSign: moon.position.sign,
        moonText: MOON_SIGN_TEXT[moon.position.index],
        aspects: [],
        events: [],
        score: 0,
      });
    }

    // 速い天体と出生図のアスペクト：最も正確になる日に割り当てる
    FAST.forEach(tKey => {
      natalPoints.forEach(natalPoint => {
        Calc.ASPECTS.forEach(aspect => {
          const orbs = [];
          for (let i = -1; i <= n; i++) orbs.push(Math.abs(separation(at(i, tKey).lon, natalPoint.lon) - aspect.angle));
          for (let i = 0; i < n; i++) {
            const orb = orbs[i + 1];
            const limit = Math.max(1, Math.abs(at(i, tKey).speed) / 2);
            if (orb > limit || orb > orbs[i] || orb > orbs[i + 2]) continue;
            const score = aspectScore(tKey, natalPoint.key, aspect.angle);
            days[i].aspects.push({
              transit: tKey, natal: natalPoint, aspect, orb, score,
              hour: tKey === 'Moon' ? moonExactHour(natalPoint.lon, aspect.angle, noonOf(i)) : null,
              text: aspectText(tKey, natalPoint, aspect, score),
            });
            days[i].score += score;
          }
        });
      });
    });

    // 天体のサイン移動・逆行/順行の切り替え
    Calc.PLANETS.filter(p => p.key !== 'Moon').forEach(p => {
      for (let i = 0; i < n; i++) {
        const prev = at(i - 1, p.key), cur = at(i, p.key);
        if (prev.position.index !== cur.position.index) {
          days[i].events.push({ type: 'ingress', text: `${p.name}が${cur.position.sign.name}に入ります。` });
        }
        if (prev.retrograde !== cur.retrograde) {
          const text = cur.retrograde ? `${p.name}が逆行を始めます。` : `${p.name}が順行に戻ります。`;
          days[i].events.push({ type: 'station', text });
          if (p.key === 'Mercury') days[i].score -= 0.5;
        }
      }
    });

    // 月の満ち欠け
    let q = Astronomy.SearchMoonQuarter(new Date(startUtcMs));
    while (q.time.date.getTime() < startUtcMs + n * DAY_MS) {
      const i = Math.floor((q.time.date.getTime() - startUtcMs) / DAY_MS);
      const local = new Date(q.time.date.getTime() + opts.tzOffset * 3600000);
      const info = QUARTER_TEXT[q.quarter];
      days[i].events.push({
        type: 'moon', quarter: q.quarter, name: info.name,
        text: `${info.name}（${local.getUTCHours()}:${String(local.getUTCMinutes()).padStart(2, '0')}）：${info.text}`,
      });
      q = Astronomy.NextMoonQuarter(q);
    }

    // 水星逆行の期間（連絡ミスに注意）
    const mercuryRetro = [];
    days.forEach(d => {
      if (!at(d.index, 'Mercury').retrograde) return;
      const last = mercuryRetro[mercuryRetro.length - 1];
      if (last && last.to.index === d.index - 1) last.to = d;
      else mercuryRetro.push({ from: d, to: d });
    });

    // 遅い天体：期間の真ん中で 1.5° 以内のアスペクトを「期間中ずっと続く影響」とする
    const mid = Math.floor(n / 2);
    const background = [];
    SLOW.forEach(tKey => {
      natalPoints.forEach(natalPoint => {
        Calc.ASPECTS.forEach(aspect => {
          const orb = Math.abs(separation(at(mid, tKey).lon, natalPoint.lon) - aspect.angle);
          if (orb > 1.5) return;
          const score = aspectScore(tKey, natalPoint.key, aspect.angle);
          background.push({ transit: tKey, natal: natalPoint, aspect, orb, score, text: aspectText(tKey, natalPoint, aspect, score) });
        });
      });
    });
    background.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

    days.forEach(d => {
      d.aspects.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
      d.score = Math.round(d.score * 10) / 10;
      d.rating = d.score >= 1.5 ? 'lucky' : d.score <= -1.5 ? 'caution' : 'normal';
    });

    // 1週間なら1日ずつ、1か月なら3日ずつ選ぶ
    const pick = n > 7 ? 3 : 1;
    const luckyDays = days.filter(d => d.score > 0).sort((a, b) => b.score - a.score).slice(0, pick);
    const cautionDays = days.filter(d => d.score < 0).sort((a, b) => a.score - b.score).slice(0, pick);
    luckyDays.sort((a, b) => a.index - b.index);
    cautionDays.sort((a, b) => a.index - b.index);

    return { days, background, mercuryRetro, luckyDays, cautionDays };
  }

  function weekly(natal, opts) {
    return { kind: 'week', ...forecast(natal, { ...opts, days: 7 }) };
  }

  function monthly(natal, opts) {
    const days = new Date(Date.UTC(opts.year, opts.month, 0)).getUTCDate();
    return { kind: 'month', year: opts.year, month: opts.month, ...forecast(natal, { ...opts, day: 1, days }) };
  }

  function dayLabel(d) {
    return `${d.month}/${d.day}（${d.weekday}）`;
  }

  function periodLabel(f) {
    if (f.kind === 'month') return `${f.year}年${f.month}月`;
    return `${dayLabel(f.days[0])}〜${dayLabel(f.days[f.days.length - 1])}`;
  }

  function retroText(r) {
    return r.from === r.to ? dayLabel(r.from) : `${dayLabel(r.from)}〜${dayLabel(r.to)}`;
  }

  // 人に伝えるための文章
  function toMessage(f, name, title) {
    const isMonth = f.kind === 'month';
    const lines = [`【${name ? name + 'さんの' : ''}${title} ${periodLabel(f)}】`, ''];
    const dayLines = (list, mark, heading, sign) => {
      if (!list.length) return;
      lines.push(`${mark} ${heading}：${list.map(dayLabel).join('、')}`);
      list.forEach(d => {
        const top = d.aspects.find(a => Math.sign(a.score) === sign);
        if (top) lines.push(`　${isMonth ? dayLabel(d) + ' ' : ''}${top.text}`);
      });
    };
    dayLines(f.luckyDays, '★', '逃さないでほしいラッキーデー', 1);
    dayLines(f.cautionDays, '⚠', '気を付けたい日', -1);
    f.mercuryRetro.forEach(r => lines.push(`⚠ 水星逆行（${retroText(r)}）：連絡ミスや予定の行き違いに気を付けて。`));
    if (f.background.length) {
      lines.push('', `◆ ${isMonth ? '今月' : '今週'}ずっと続く星の影響`);
      f.background.slice(0, 2).forEach(b => lines.push(`　${b.text}`));
    }
    if (isMonth) {
      const moons = f.days.flatMap(d => d.events.filter(e => e.type === 'moon' && (e.quarter === 0 || e.quarter === 2)).map(e => `${dayLabel(d)} ${e.text}`));
      if (moons.length) {
        lines.push('', '◆ 新月・満月');
        moons.forEach(t => lines.push(`　${t}`));
      }
    } else {
      lines.push('', '◆ 毎日のポイント');
      f.days.forEach(d => {
        const mark = d.rating === 'lucky' ? '★' : d.rating === 'caution' ? '⚠' : '・';
        const top = d.aspects[0];
        lines.push(`${mark} ${dayLabel(d)} 月は${d.moonSign.name}：${d.moonText}${top ? '。' + top.text : '。'}`);
      });
    }
    return lines.join('\n');
  }

  return { weekly, monthly, toMessage, dayLabel, periodLabel, retroText };
});
