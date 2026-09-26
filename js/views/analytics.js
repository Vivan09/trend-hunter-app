// Аналитика: как менялись показатели и где смотрят (FR-025).
//
// Здесь намеренно нет «прогнозов» и «инсайтов». Раздел отвечает на один
// вопрос — что уже произошло с базой, — и любые досчитанные величины поверх
// измеренных только запутали бы.

import { getAnalytics } from "../api.js";
import { html, raw, dateLabel } from "../format.js";
import { skeleton, skelTiles, skelBlock } from "../components/skeleton.js";

// Линий ровно три: акцентный лайм интерфейса не проходит проверку яркости
// на тёмной подложке, а четвёртая серия того же зелёного семейства слилась бы
// с Trend. Opportunity показывается числом — он и так итог, а не ряд.
const SERIES = [
  { key: "trend", label: "Trend", color: "var(--series-trend)" },
  { key: "search", label: "Search", color: "var(--series-search)" },
  { key: "competition", label: "Competition", color: "var(--series-competition)" },
];

const NUMBERS = [...SERIES, { key: "opportunity", label: "Opportunity" }];

const W = 320;
const H = 90;

export async function analyticsView(mount) {
  mount.insertAdjacentHTML(
    "beforeend",
    html`
      <header class="view-head">
        <div>
          <p class="eyebrow">Аналитика</p>
          <h1 class="view-title">Как менялось</h1>
        </div>
      </header>
      <div id="analytics">
        <p class="sr-only" role="status">Загружаю…</p>
        ${raw(skeleton(skelTiles(4), skelBlock(180)))}
      </div>
    `,
  );

  const target = mount.querySelector("#analytics");
  try {
    const payload = await getAnalytics();
    target.innerHTML = totals(payload.totals) + sparks(payload.series) + geo(payload.geo);
  } catch (error) {
    target.innerHTML = html`<div class="alert">${error.message}</div>`;
  }
}

function totals(numbers) {
  const tiles = [
    [numbers.trends, "трендов в базе"],
    [numbers.verified, "проверено в магазине"],
    [numbers.rising, "набирают скорость"],
    [numbers.free_niche, "со свободной нишей"],
    [numbers.with_ideas, "с идеями"],
    [numbers.inactive, "перестали встречаться"],
  ];
  return html`<div class="tiles">
    ${raw(
      tiles
        .map(
          ([value, label]) => html`<div class="tile">
            <p class="tile__value">${value}</p>
            <p class="tile__label">${label}</p>
          </div>`,
        )
        .join(""),
    )}
  </div>`;
}

function sparks(series) {
  const withHistory = series.filter((row) => row.points.length > 1);
  if (!withHistory.length) {
    return html`<section class="section">
      <div class="panel">
        <p class="note">
          Линии появятся, когда у трендов накопится хотя бы по две записи истории.
        </p>
      </div>
    </section>`;
  }
  return html`
    <section class="section">
      <div class="section__head">
        <h2 class="eyebrow">Динамика по трендам</h2>
        <ul class="legend">
          ${raw(
            SERIES.map(
              (s) => html`<li>
                <span class="legend__mark" style="background:${raw(s.color)}"></span>${s.label}
              </li>`,
            ).join(""),
          )}
        </ul>
      </div>
      <div class="sparks">${raw(withHistory.map(spark).join(""))}</div>
    </section>
  `;
}

function spark(row) {
  const times = row.points.map((point) => Date.parse(point.ts));
  const from = Math.min(...times);
  const span = Math.max(Math.max(...times) - from, 1);
  const x = (time) => 4 + ((time - from) / span) * (W - 8);
  const y = (value) => H - 6 - (value / 100) * (H - 12);

  const lines = SERIES.map((serie) => {
    const points = row.points
      .filter((point) => point[serie.key] !== null && point[serie.key] !== undefined)
      .map((point) => `${x(Date.parse(point.ts))},${y(point[serie.key])}`);
    return points.length > 1
      ? `<polyline class="chart__line" points="${points.join(" ")}" stroke="${serie.color}" />`
      : "";
  }).join("");

  const last = row.points[row.points.length - 1];
  return html`
    <figure class="spark">
      <figcaption>
        <a href="#/trend/${encodeURIComponent(row.slug)}">${row.title}</a>
        <span class="runline">${dateLabel(last.ts)}</span>
      </figcaption>
      <svg viewBox="0 0 ${W} ${H}" role="img"
        aria-label="Динамика тренда ${row.title}, ${row.points.length} точек">
        ${raw(lines)}
      </svg>
      <dl class="scorebar">
        ${raw(
          NUMBERS.map(
            (serie) => html`<div class="metric">
              <dt class="metric__label">${serie.label}</dt>
              <dd class="metric__value">${last[serie.key] ?? "—"}</dd>
            </div>`,
          ).join(""),
        )}
      </dl>
    </figure>
  `;
}

function geo(rows) {
  if (!rows.length) {
    return html`<section class="section">
      <div class="panel"><p class="note">География ещё не собрана.</p></div>
    </section>`;
  }
  const max = Math.max(...rows.map((row) => row.interest), 1);
  return html`
    <section class="section">
      <div class="section__head"><h2 class="eyebrow">Где смотрят</h2></div>
      <ul class="geo">
        ${raw(
          rows
            .slice(0, 12)
            .map(
              (row) => html`<li>
                <span class="geo__code">${row.code}</span>
                <span class="geo__bar"
                  ><i style="width:${raw(String(Math.round((row.interest / max) * 100)))}%"></i
                ></span>
                <span class="geo__value">${row.interest}</span>
              </li>`,
            )
            .join(""),
        )}
      </ul>
    </section>
  `;
}
