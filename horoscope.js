// 都道府県庁所在地の緯度・経度
const PLACES = [
  ['札幌市（北海道）', 43.06, 141.35], ['青森市', 40.82, 140.74], ['盛岡市', 39.70, 141.15],
  ['仙台市', 38.27, 140.87], ['秋田市', 39.72, 140.10], ['山形市', 38.24, 140.36],
  ['福島市', 37.75, 140.47], ['水戸市', 36.34, 140.45], ['宇都宮市', 36.57, 139.88],
  ['前橋市', 36.39, 139.06], ['さいたま市', 35.86, 139.65], ['千葉市', 35.61, 140.12],
  ['東京（新宿区）', 35.69, 139.69], ['横浜市', 35.45, 139.64], ['新潟市', 37.90, 139.02],
  ['富山市', 36.70, 137.21], ['金沢市', 36.59, 136.63], ['福井市', 36.07, 136.22],
  ['甲府市', 35.66, 138.57], ['長野市', 36.65, 138.18], ['岐阜市', 35.39, 136.72],
  ['静岡市', 34.98, 138.38], ['名古屋市', 35.18, 136.91], ['津市', 34.73, 136.51],
  ['大津市', 35.00, 135.87], ['京都市', 35.02, 135.76], ['大阪市', 34.69, 135.52],
  ['神戸市', 34.69, 135.18], ['奈良市', 34.69, 135.83], ['和歌山市', 34.23, 135.17],
  ['鳥取市', 35.50, 134.24], ['松江市', 35.47, 133.05], ['岡山市', 34.66, 133.93],
  ['広島市', 34.40, 132.46], ['山口市', 34.19, 131.47], ['徳島市', 34.07, 134.56],
  ['高松市', 34.34, 134.04], ['松山市', 33.84, 132.77], ['高知市', 33.56, 133.53],
  ['福岡市', 33.61, 130.42], ['佐賀市', 33.25, 130.30], ['長崎市', 32.74, 129.87],
  ['熊本市', 32.79, 130.74], ['大分市', 33.24, 131.61], ['宮崎市', 31.91, 131.42],
  ['鹿児島市', 31.56, 130.56], ['那覇市（沖縄県）', 26.21, 127.68],
];
const DEFAULT_PLACE = '東京（新宿区）';

const ASPECT_POINTS_LABEL = { ASC: 'ASC', MC: 'MC' };

const form = document.getElementById('horo-form');
const dateInput = document.getElementById('birth-date');
const timeInput = document.getElementById('birth-time');
const timeUnknown = document.getElementById('time-unknown');
const tzSelect = document.getElementById('tz-offset');
const placeSelect = document.getElementById('birth-place');
const latInput = document.getElementById('birth-lat');
const lonInput = document.getElementById('birth-lon');
const houseSelect = document.getElementById('house-system');
const errorText = document.getElementById('error-text');
const printBtn = document.getElementById('print-btn');
const result = document.getElementById('result');

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatDegMin(pos) {
  return `${pos.deg}°${pad2(pos.min)}′`;
}

function formatSpeed(speed) {
  if (speed === null) return '—';
  const abs = Math.abs(speed);
  const d = Math.floor(abs);
  const m = Math.round((abs - d) * 60);
  return `${speed < 0 ? '−' : '+'}${d}°${pad2(m)}′`;
}

function initForm() {
  for (let h = -12; h <= 14; h++) {
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = h === 9 ? 'UTC+9（日本標準時）' : `UTC${h >= 0 ? '+' : '−'}${Math.abs(h)}`;
    tzSelect.appendChild(opt);
  }
  tzSelect.value = '9';

  PLACES.forEach(([name, lat, lon]) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    opt.dataset.lat = lat;
    opt.dataset.lon = lon;
    placeSelect.appendChild(opt);
  });
  const custom = document.createElement('option');
  custom.value = 'custom';
  custom.textContent = 'その他（緯度・経度を入力）';
  placeSelect.appendChild(custom);
  placeSelect.value = DEFAULT_PLACE;
  applyPlace();

  placeSelect.addEventListener('change', applyPlace);
  [latInput, lonInput].forEach(el => el.addEventListener('input', () => { placeSelect.value = 'custom'; }));
  timeUnknown.addEventListener('change', () => {
    timeInput.disabled = timeUnknown.checked;
    houseSelect.disabled = timeUnknown.checked;
  });
  printBtn.addEventListener('click', () => window.print());
}

function applyPlace() {
  const opt = placeSelect.selectedOptions[0];
  if (!opt || opt.value === 'custom') return;
  latInput.value = opt.dataset.lat;
  lonInput.value = opt.dataset.lon;
}

function showError(message) {
  errorText.textContent = message;
  errorText.hidden = false;
}

function readInput() {
  if (!dateInput.value) throw new Error('生年月日を入力してください。');
  const [year, month, day] = dateInput.value.split('-').map(Number);
  const known = !timeUnknown.checked;
  if (known && !timeInput.value) throw new Error('出生時刻を入力するか「時刻不明」にチェックしてください。');
  const [hour, minute] = known ? timeInput.value.split(':').map(Number) : [12, 0];
  const lat = parseFloat(latInput.value);
  const lon = parseFloat(lonInput.value);
  if (!(Math.abs(lat) < 90) || !(Math.abs(lon) <= 180)) throw new Error('緯度・経度を正しく入力してください。');
  return {
    year, month, day, hour, minute,
    tzOffset: Number(tzSelect.value),
    lat, lon,
    timeKnown: known,
    houseSystem: houseSelect.value,
  };
}

function signCell(pos) {
  return `<span class="sign-symbol el-${pos.sign.element}">${pos.sign.symbol}</span>${pos.sign.name}`;
}

function renderMeta(input, data) {
  const place = placeSelect.value === 'custom' ? 'その他' : placeSelect.value;
  const tz = `UTC${input.tzOffset >= 0 ? '+' : '−'}${Math.abs(input.tzOffset)}`;
  const time = input.timeKnown ? `${pad2(input.hour)}:${pad2(input.minute)}` : '時刻不明（正午で計算）';
  const latText = `${input.lat >= 0 ? '北緯' : '南緯'}${Math.abs(input.lat).toFixed(2)}°`;
  const lonText = `${input.lon >= 0 ? '東経' : '西経'}${Math.abs(input.lon).toFixed(2)}°`;
  const u = data.utc;
  const utcText = `${u.getUTCFullYear()}/${pad2(u.getUTCMonth() + 1)}/${pad2(u.getUTCDate())} ${pad2(u.getUTCHours())}:${pad2(u.getUTCMinutes())}`;
  const lstH = Math.floor(data.lst);
  const lstM = Math.floor((data.lst - lstH) * 60);
  const lstS = Math.floor(((data.lst - lstH) * 60 - lstM) * 60);
  const systemNames = { placidus: 'プラシーダス', equal: 'イコール', whole: 'ホールサイン' };

  const rows = [
    ['生年月日・時刻', `${input.year}年${input.month}月${input.day}日 ${time}（${tz}）`],
    ['出生地', `${place}　${latText}　${lonText}`],
    ['世界時（UT）', utcText],
    ['地方恒星時', `${lstH}h ${pad2(lstM)}m ${pad2(lstS)}s`],
    ['ユリウス日', data.julianDayUT.toFixed(5)],
  ];
  if (data.houses) {
    let systemText = systemNames[data.houses.usedSystem];
    if (data.houses.usedSystem !== input.houseSystem) systemText += '（高緯度のためプラシーダスの代わりに使用）';
    rows.push(['ハウス分割法', systemText]);
  }
  document.getElementById('result-meta').innerHTML =
    '<h2>基本データ</h2><dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
}

function renderWheel(data) {
  document.getElementById('wheel').innerHTML = HoroscopeWheel.render(data);
  document.getElementById('wheel-note').textContent = data.houses
    ? 'アセンダント（ASC）を左に置いています。中心の線はアスペクト（緑：120°、青点線：60°、赤：90°、橙：180°）です。'
    : '時刻不明のため、牡羊座0°を左に置き、ハウスは表示していません。中心の線はアスペクト（緑：120°、青点線：60°、赤：90°、橙：180°）です。';
}

function renderPlanets(data) {
  const tbody = document.querySelector('#planet-table tbody');
  tbody.innerHTML = data.points.map(p => `
    <tr>
      <td class="point-name"><span class="planet-symbol">${ASPECT_POINTS_LABEL[p.key] ? '' : p.symbol}</span>${p.name}${p.retrograde && p.speed !== null ? '<span class="retro">R</span>' : ''}</td>
      <td class="sign-name">${signCell(p.position)}</td>
      <td class="num">${formatDegMin(p.position)}</td>
      <td class="num">${p.lon.toFixed(2)}°</td>
      <td class="num">${formatSpeed(p.speed)}</td>
      <td class="num">${p.house ?? '—'}</td>
    </tr>`).join('');
}

function renderHouses(data) {
  const section = document.getElementById('house-section');
  if (!data.houses) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  const cell = i => {
    const pos = HoroscopeCalc.toSign(data.houses.cusps[i]);
    const label = i === 0 ? '1（ASC）' : i === 9 ? '10（MC）' : String(i + 1);
    return `<td class="num">${label}</td><td class="sign-name">${signCell(pos)}</td><td class="num">${formatDegMin(pos)}</td>`;
  };
  const rows = [];
  for (let i = 0; i < 6; i++) rows.push(`<tr>${cell(i)}${cell(i + 6)}</tr>`);
  document.querySelector('#house-table tbody').innerHTML = rows.join('');
}

function renderAspects(data) {
  const points = data.points;
  const lookup = {};
  data.aspects.forEach(a => { lookup[`${a.a}|${a.b}`] = a; });
  const label = p => ASPECT_POINTS_LABEL[p.key] || p.symbol;

  let html = '<thead><tr><th></th>' + points.slice(0, -1).map(p => `<th title="${p.name}">${label(p)}</th>`).join('') + '</tr></thead><tbody>';
  for (let i = 1; i < points.length; i++) {
    html += `<tr><th title="${points[i].name}">${label(points[i])}</th>`;
    for (let j = 0; j < points.length - 1; j++) {
      if (j >= i) {
        html += '<td class="empty"></td>';
        continue;
      }
      const a = lookup[`${points[j].key}|${points[i].key}`];
      html += a
        ? `<td class="asp asp-${a.aspect.angle}" title="${points[j].name}と${points[i].name}：${a.aspect.name}（オーブ${a.orb.toFixed(1)}°）"><span>${a.aspect.symbol}</span><small>${a.orb.toFixed(1)}</small></td>`
        : '<td></td>';
    }
    html += '</tr>';
  }
  document.getElementById('aspect-grid').innerHTML = html + '</tbody>';

  document.getElementById('aspect-legend').innerHTML = HoroscopeCalc.ASPECTS
    .map(a => `<span class="asp-${a.angle}">${a.symbol}</span> ${a.name}（${a.angle}°・オーブ${a.orb}°）`)
    .join('　') + '　／ 数字はオーブ（度）';
}

function renderBalance(data) {
  const row = (title, groups) => Object.entries(groups)
    .map(([name, list], idx) => `<tr>${idx === 0 ? `<th rowspan="${Object.keys(groups).length}">${title}</th>` : ''}<td class="num">${name}</td><td class="num">${list.length}</td><td class="balance-list">${list.join(' ')}</td></tr>`)
    .join('');
  document.getElementById('balance-table').innerHTML =
    '<thead><tr><th>区分</th><th>種類</th><th>天体数</th><th>天体</th></tr></thead><tbody>' +
    row('エレメント', data.elements) + row('クオリティ', data.modes) + '</tbody>';
}

const weekStartInput = document.getElementById('week-start');
const monthPick = document.getElementById('month-pick');
const forecastName = document.getElementById('forecast-name');
const forecastMessage = document.getElementById('forecast-message');
const copyBtn = document.getElementById('copy-btn');
const periodTabs = document.querySelectorAll('.fc-tab');
let lastChart = null;
let period = 'week';
let lastForecast = null;

function localToday(tzOffset) {
  const d = new Date(Date.now() + tzOffset * 3600000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function todayString(tzOffset) {
  const t = localToday(tzOffset);
  return `${t.year}-${pad2(t.month)}-${pad2(t.day)}`;
}

function nextMonthString(tzOffset) {
  const t = localToday(tzOffset);
  return t.month === 12 ? `${t.year + 1}-01` : `${t.year}-${pad2(t.month + 1)}`;
}

function forecastTitle(f, tzOffset) {
  const t = localToday(tzOffset);
  if (f.kind === 'week') return weekStartInput.value === todayString(tzOffset) ? '今週の星読み' : '1週間の星読み';
  if (f.year === t.year && f.month === t.month) return '今月の運勢';
  if (`${f.year}-${pad2(f.month)}` === nextMonthString(tzOffset)) return '来月の運勢';
  return `${f.year}年${f.month}月の運勢`;
}

const RATING_LABEL = { lucky: '★ ラッキー', caution: '⚠ 注意', normal: '・ おだやか' };
const RATING_MARK = { lucky: '★', caution: '⚠', normal: '' };

function aspectLine(a) {
  const time = a.hour !== null && a.hour !== undefined ? `<span class="fc-time">${a.hour}時ごろ</span>` : '';
  const kind = a.score >= 0 ? 'good' : 'bad';
  return `<li class="fc-${kind}"><span class="fc-mark">${a.score >= 0 ? '◎' : '△'}</span>${time}${a.text}</li>`;
}

function highlightCard(kind, heading, days, sign) {
  if (!days.length) return '';
  const label = HoroscopeForecast.dayLabel;
  const items = days.map(d => {
    const top = d.aspects.find(a => Math.sign(a.score) === sign);
    return `<li><a class="fc-date" href="#fc-day-${d.index}">${label(d)}</a><p>${top ? top.text : d.moonText}</p></li>`;
  }).join('');
  return `<div class="fc-highlight fc-highlight-${kind}"><h3>${heading}</h3><ul class="fc-pick">${items}</ul></div>`;
}

function setPeriod(next) {
  period = next;
  periodTabs.forEach(tab => {
    const active = tab.dataset.period === period;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-pressed', String(active));
  });
  document.getElementById('week-label').hidden = period !== 'week';
  document.getElementById('month-label').hidden = period !== 'month';
  if (lastChart) {
    if (period === 'week') weekStartInput.value = todayString(lastChart.input.tzOffset);
    else monthPick.value = nextMonthString(lastChart.input.tzOffset);
  }
  renderForecast();
}

function renderForecast() {
  if (!lastChart) return;
  const { input, data } = lastChart;
  const place = { tzOffset: input.tzOffset, lat: input.lat, lon: input.lon };
  let f;
  if (period === 'month') {
    if (!monthPick.value) monthPick.value = nextMonthString(input.tzOffset);
    const [year, month] = monthPick.value.split('-').map(Number);
    f = HoroscopeForecast.monthly(data, { year, month, ...place });
  } else {
    if (!weekStartInput.value) weekStartInput.value = todayString(input.tzOffset);
    const [year, month, day] = weekStartInput.value.split('-').map(Number);
    f = HoroscopeForecast.weekly(data, { year, month, day, ...place });
  }
  const isMonth = f.kind === 'month';
  const title = forecastTitle(f, input.tzOffset);
  const label = HoroscopeForecast.dayLabel;
  document.getElementById('forecast-title').textContent = `${title}（${HoroscopeForecast.periodLabel(f)}）`;

  const highlights = [
    highlightCard('lucky', '★ 逃さないでほしいラッキーデー', f.luckyDays, 1),
    highlightCard('caution', '⚠ 気を付けたい日', f.cautionDays, -1),
  ];
  const notes = f.mercuryRetro.map(r =>
    `<li class="fc-bad"><span class="fc-mark">△</span>水星逆行（${HoroscopeForecast.retroText(r)}）：連絡ミスや予定の行き違いに気を付けて。</li>`);
  f.background.slice(0, 3).forEach(b => notes.push(aspectLine(b)));
  if (notes.length) {
    highlights.push(`<div class="fc-highlight fc-highlight-week"><h3>${isMonth ? '今月' : '今週'}ずっと続く星の影響</h3><ul class="fc-list">${notes.join('')}</ul></div>`);
  }
  document.getElementById('forecast-highlights').innerHTML = highlights.join('');

  const strip = document.getElementById('forecast-strip');
  strip.classList.toggle('fc-calendar', isMonth);
  const lucky = new Set(f.luckyDays);
  const caution = new Set(f.cautionDays);
  // 選ばれたラッキーデー・気を付けたい日は、点数の段階に関係なく印を付ける
  const badgeOf = d => (lucky.has(d) ? '★ ラッキー' : caution.has(d) ? '⚠ 注意' : RATING_LABEL[d.rating]);
  const markOf = d => (lucky.has(d) ? '★' : caution.has(d) ? '⚠' : RATING_MARK[d.rating]);
  const cell = d => {
    const pickClass = lucky.has(d) ? ' fc-best' : caution.has(d) ? ' fc-worst' : '';
    const moonEvent = d.events.find(e => e.type === 'moon' && (e.quarter === 0 || e.quarter === 2));
    return `
    <a class="fc-day fc-${lucky.has(d) ? 'lucky' : caution.has(d) ? 'caution' : d.rating}${pickClass}" href="#fc-day-${d.index}" title="${label(d)} ${badgeOf(d)}">
      ${isMonth ? '' : `<span class="fc-wd">${d.weekday}</span>`}
      <span class="fc-md">${isMonth ? d.day : `${d.month}/${d.day}`}</span>
      <span class="fc-badge">${isMonth ? markOf(d) || '&nbsp;' : badgeOf(d)}</span>
      <span class="fc-moon">${moonEvent ? (moonEvent.quarter === 0 ? '●' : '○') : '月'} ${d.moonSign.symbol}︎</span>
    </a>`;
  };
  if (isMonth) {
    const firstWeekday = ['日', '月', '火', '水', '木', '金', '土'].indexOf(f.days[0].weekday);
    strip.innerHTML = ['日', '月', '火', '水', '木', '金', '土'].map(w => `<span class="fc-head">${w}</span>`).join('') +
      '<span class="fc-blank"></span>'.repeat(firstWeekday) + f.days.map(cell).join('');
  } else {
    strip.innerHTML = f.days.map(cell).join('');
  }

  document.getElementById('forecast-days').innerHTML = f.days.map(d => {
    const open = !isMonth || d.rating !== 'normal' || lucky.has(d) || caution.has(d);
    return `
    <details class="fc-detail fc-${lucky.has(d) ? 'lucky' : caution.has(d) ? 'caution' : d.rating}" id="fc-day-${d.index}"${open ? ' open' : ''}>
      <summary><h3>${label(d)}<span class="fc-badge">${badgeOf(d)}</span></h3></summary>
      <p class="fc-moonline">月は${d.moonSign.name}：${d.moonText}</p>
      <ul class="fc-list">
        ${d.events.map(e => `<li class="fc-event"><span class="fc-mark">☆</span>${e.text}</li>`).join('')}
        ${d.aspects.slice(0, 3).map(aspectLine).join('')}
      </ul>
    </details>`;
  }).join('');

  lastForecast = { f, title };
  updateMessage();
}

function updateMessage() {
  if (!lastForecast) return;
  forecastMessage.value = HoroscopeForecast.toMessage(lastForecast.f, forecastName.value.trim(), lastForecast.title);
}

// 日付リンクで閉じている日の詳細を開く
document.getElementById('forecast-section').addEventListener('click', e => {
  const link = e.target.closest('a[href^="#fc-day-"]');
  if (!link) return;
  e.preventDefault();
  const target = document.getElementById(link.getAttribute('href').slice(1));
  if (!target) return;
  target.open = true;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

periodTabs.forEach(tab => tab.addEventListener('click', () => setPeriod(tab.dataset.period)));
document.getElementById('week-btn').addEventListener('click', renderForecast);
forecastName.addEventListener('input', updateMessage);
copyBtn.addEventListener('click', () => {
  const done = () => {
    copyBtn.textContent = 'コピーしました';
    setTimeout(() => { copyBtn.textContent = 'コピー'; }, 2000);
  };
  const fallback = () => {
    forecastMessage.focus();
    forecastMessage.select();
    copyBtn.textContent = '選択しました。コピーしてください';
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(forecastMessage.value).then(done, fallback);
  } else {
    fallback();
  }
});

form.addEventListener('submit', e => {
  e.preventDefault();
  errorText.hidden = true;
  if (typeof Astronomy === 'undefined') {
    showError('天文計算ライブラリを読み込めませんでした。インターネット接続を確認してください。');
    return;
  }
  try {
    const input = readInput();
    const data = HoroscopeCalc.calculate(input);
    renderMeta(input, data);
    renderWheel(data);
    renderPlanets(data);
    renderHouses(data);
    renderAspects(data);
    renderBalance(data);
    lastChart = { input, data };
    renderForecast();
    result.hidden = false;
    printBtn.hidden = false;
    // 読み込み時の例の表示ではスクロールしない
    if (e.isTrusted) result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    showError(err.message);
  }
});

initForm();

// 開いた直後に例のホロスコープを表示する
dateInput.value = '2000-01-01';
timeInput.value = '21:00';
form.dispatchEvent(new Event('submit', { cancelable: true }));
