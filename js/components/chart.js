// График трёх показателей во времени.
//
// Одна шкала 0–100 на все три серии, поэтому второй оси нет и не появится:
// две оси в одном графике позволяют нарисовать любую нужную картину и потому
// врут по построению. Цвета проверены валидатором на подложке #1B1D21,
// включая дальтонизм; порядок закреплён за сущностью, а не за рангом, — фильтр
// не перекрашивает выживших.
//
// Прогноз намеренно отделён от данных: пунктир, штриховка и подпись. Линейная
// экстраполяция — не предсказание, а продолжение прямой, и выдавать её за факт
// нельзя.
//
// Наведение ведёт перекрестие, привязанное к БЛИЖАЙШЕЙ записи, а не к пикселю:
// между прогонами данных нет, и плавное скольжение рисовало бы значения там,
// где их никто не мерил. Кнопки легенды гасят линию, но не выкидывают её из
// легенды — что скрыто, обязано остаться названным.

import { html, raw, escapeHtml, dateLabel } from "../format.js";

const SERIES = [
  { key: "trend", label: "Trend", color: "var(--series-trend)", hex: "#7E9A24" },
  { key: "search", label: "Search", color: "var(--series-search)", hex: "#3E9BC7" },
  {
    key: "competition",
    label: "Competition",
    color: "var(--series-competition)",
    hex: "#D9548C",
  },
];

const W = 760;
const H = 260;
// top держит два ряда подписей меток: налезающая на соседку подпись уходит
// строкой ниже, а не поверх неё (раскладка в markers()).
const PAD = { top: 30, right: 96, bottom: 34, left: 38 };
const FORECAST_DAYS = 7;
const FIT_POINTS = 6;
const DAY = 86400000;

export function chart(trend) {
  const points = parsePoints(trend);

  if (points.length < 2) {
    return html`<div class="panel">
      <p class="note">
        Точка всего одна — линия появится со второго прогона. История тренда
        накапливается и никогда не переписывается.
      </p>
    </div>`;
  }

  const now = points[points.length - 1].time;
  const forecastEnd = now + FORECAST_DAYS * DAY;
  const from = points[0].time;
  const span = Math.max(forecastEnd - from, DAY);

  const x = (time) => PAD.left + ((time - from) / span) * (W - PAD.left - PAD.right);
  const y = (value) => PAD.top + (1 - value / 100) * (H - PAD.top - PAD.bottom);

  const firstSeen = Date.parse(trend.first_seen);
  const marks = [];
  if (Number.isFinite(firstSeen) && firstSeen >= from && firstSeen <= now) {
    marks.push({ time: firstSeen, label: "первая встреча" });
  }
  // Формула конкуренции изменена фичей 003: прежде она считала всю выдачу
  // магазина вместе с посторонними приложениями. Прежние записи не
  // переписываются (FR-008), поэтому скачок обязан быть подписан — иначе он
  // читается как поведение тренда (FR-009).
  const switched = points.find((entry) => entry.competition_method === "relevant");
  if (switched && switched.time > from) {
    marks.push({ time: switched.time, label: "формула изменена" });
  }
  marks.push({ time: now, label: "сейчас" });

  return html`
    <figure class="chart">
      <figcaption class="chart__head">
        <p class="eyebrow">Динамика показателей</p>
        <ul class="legend">
          ${raw(
            SERIES.map(
              (series) => html`<li>
                <button
                  type="button"
                  class="legend__toggle"
                  data-toggle="${series.key}"
                  aria-pressed="true"
                  title="Скрыть или вернуть линию"
                >
                  <span class="legend__mark" style="background:${raw(series.color)}"></span>
                  ${series.label}
                </button>
              </li>`,
            ).join(""),
          )}
          <li><span class="legend__mark legend__mark--forecast"></span>прогноз</li>
        </ul>
      </figcaption>

      <svg
        class="chart__svg"
        viewBox="0 0 ${W} ${H}"
        role="img"
        aria-label="${raw(ariaLabel(trend, points))}"
      >
        <defs>
          <pattern
            id="window-hatch"
            width="7"
            height="7"
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="0" x2="0" y2="7" stroke="#2c3038" stroke-width="2" />
          </pattern>
        </defs>

        ${raw(grid(y))}
        <rect
          x="${x(now)}"
          y="${PAD.top}"
          width="${Math.max(0, x(forecastEnd) - x(now))}"
          height="${H - PAD.top - PAD.bottom}"
          fill="url(#window-hatch)"
          opacity="0.9"
        />
        ${raw(dateTicks(from, now, x))}
        ${raw(markers(marks, x, now))}
        ${raw(
          SERIES.map(
            (series) => `
              <g class="chart__series" data-series="${series.key}">
                ${seriesPath(series, points, x, y, now, forecastEnd)}
              </g>
            `,
          ).join(""),
        )}
        ${raw(
          SERIES.map(
            (series) => `
              <g class="chart__series" data-series="${series.key}">
                ${endLabel(series, points, x, y)}
              </g>
            `,
          ).join(""),
        )}
        <g class="chart__cross" style="display:none">
          <line class="chart__cross-line" x1="0" x2="0" y1="${PAD.top}" y2="${H - PAD.bottom}" />
          ${raw(
            SERIES.map(
              (series) => `
                <circle class="chart__cross-dot" data-cross="${series.key}" r="4.5"
                  fill="${series.color}" stroke="var(--card)" stroke-width="2" />
              `,
            ).join(""),
          )}
        </g>
        <text class="chart__axis" x="${PAD.left}" y="${H - 12}">
          ${dateLabel(new Date(from).toISOString())}
        </text>
        <text class="chart__axis" x="${x(now)}" y="${H - 12}" text-anchor="middle">
          ${dateLabel(new Date(now).toISOString())}
        </text>
      </svg>

      <div class="chart__tip" hidden></div>

      <details class="chart__table">
        <summary>Таблица значений</summary>
        ${raw(table(points))}
      </details>
    </figure>
  `;
}

function parsePoints(trend) {
  return (trend.history || [])
    .map((entry) => ({ ...entry, time: Date.parse(entry.ts) }))
    .filter((entry) => Number.isFinite(entry.time))
    .sort((a, b) => a.time - b.time);
}

/**
 * Промежуточные деления оси дат.
 *
 * Прежде подписей было две — начало и «сейчас», — и середину месячной истории
 * приходилось прикидывать на глаз. Деления ставятся на четвертях замеренного
 * отрезка и округляются к началу суток: дата «на глаз между 12-м и 26-м» —
 * это не дата. Деление, налезающее на крайние подписи, не рисуется вовсе —
 * нечитаемая цифра хуже отсутствующей.
 */
function dateTicks(from, now, x) {
  const edgeGap = 64;
  const ticks = [];
  for (const share of [0.25, 0.5, 0.75]) {
    const day = Math.round((from + (now - from) * share) / DAY) * DAY;
    const px = x(day);
    if (px - x(from) < edgeGap || x(now) - px < edgeGap) continue;
    if (ticks.some((known) => Math.abs(x(known) - px) < edgeGap)) continue;
    ticks.push(day);
  }
  return ticks
    .map(
      (day) => `
        <line class="chart__tick" x1="${x(day)}" y1="${H - PAD.bottom}" x2="${x(day)}" y2="${H - PAD.bottom + 5}" />
        <text class="chart__axis" x="${x(day)}" y="${H - 12}" text-anchor="middle">
          ${escapeHtml(dateLabel(new Date(day).toISOString()))}
        </text>
      `,
    )
    .join("");
}

/**
 * Прочерчивание линий.
 *
 * Длина берётся через getTotalLength() один раз: у полилинии нет CSS-способа
 * узнать собственную длину, а без неё dasharray не выставить. Серия с
 * разрывами в данных распадается на несколько полилиний — они идут вместе,
 * как одна.
 */
function drawLines(svg) {
  svg
    .querySelectorAll(".chart__line:not(.chart__line--forecast)")
    .forEach((line) => {
      line.style.setProperty("--len", `${line.getTotalLength()}px`);
    });
  svg.classList.add("chart--draw");
}

/**
 * Наведение и касание: перекрестие, точки на линиях и значения всех серий
 * в ближайшей записи. Кнопки легенды гасят и возвращают серии.
 * Вызывается после вставки разметки — график остаётся читаемым и без этого.
 * Здесь же запускается прочерчивание линий (drawLines).
 */
export function bindChart(root, trend) {
  const figure = root.querySelector(".chart");
  const svg = figure?.querySelector(".chart__svg");
  const tip = figure?.querySelector(".chart__tip");
  if (!figure || !svg || !tip) return;

  const points = parsePoints(trend);
  if (points.length < 2) return;

  // Та же шкала, что при отрисовке, включая хвост прогноза: перекрестие,
  // посчитанное по другой шкале, стояло бы мимо своей линии.
  const from = points[0].time;
  const now = points[points.length - 1].time;
  const span = Math.max(now + FORECAST_DAYS * DAY - from, DAY);
  const x = (time) => PAD.left + ((time - from) / span) * (W - PAD.left - PAD.right);
  const y = (value) => PAD.top + (1 - value / 100) * (H - PAD.top - PAD.bottom);

  const cross = svg.querySelector(".chart__cross");
  const crossLine = cross.querySelector(".chart__cross-line");
  const crossDots = {};
  cross.querySelectorAll("[data-cross]").forEach((dot) => {
    crossDots[dot.dataset.cross] = dot;
  });

  const off = new Set();

  const hide = () => {
    tip.hidden = true;
    cross.style.display = "none";
  };

  const show = (event) => {
    const box = svg.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    const wanted = from + ((ratio * W - PAD.left) / (W - PAD.left - PAD.right)) * span;
    const nearest = points.reduce((best, point) =>
      Math.abs(point.time - wanted) < Math.abs(best.time - wanted) ? point : best,
    );

    cross.style.display = "";
    const px = x(nearest.time);
    crossLine.setAttribute("x1", px);
    crossLine.setAttribute("x2", px);
    for (const series of SERIES) {
      const dot = crossDots[series.key];
      const value = nearest[series.key];
      const hidden = off.has(series.key) || value === null || value === undefined;
      dot.style.display = hidden ? "none" : "";
      if (!hidden) {
        dot.setAttribute("cx", px);
        dot.setAttribute("cy", y(value));
      }
    }

    // Opportunity в подсказке без линии на графике: это производная тех трёх
    // серий, что уже нарисованы, и четвёртая линия говорила бы то же дважды.
    const opportunity =
      nearest.opportunity === null || nearest.opportunity === undefined
        ? ""
        : `<span class="chart__tip-op">Opportunity: <b>${nearest.opportunity}</b></span>`;
    tip.innerHTML =
      `<b>${escapeHtml(dateLabel(nearest.ts))}</b>` +
      SERIES.filter((series) => !off.has(series.key))
        .map(
          (series) =>
            `<span><i style="background:${series.color}"></i>${series.label}: ` +
            `${nearest[series.key] ?? "нет данных"}</span>`,
        )
        .join("") +
      opportunity;
    tip.hidden = false;
    // Сбоку от перекрестия, а не на нём: подсказка, накрывшая точки замера,
    // прячет ровно то, что объясняет. Сторона выбирается по свободному месту.
    const anchor = (px / W) * box.width;
    const rightSide = anchor < box.width * 0.62;
    tip.style.left = `${anchor}px`;
    tip.style.transform = rightSide
      ? "translateX(14px)"
      : "translateX(calc(-100% - 14px))";
    tip.style.top = `${Math.max(event.clientY - box.top - 14, 8)}px`;
  };

  svg.addEventListener("pointerleave", hide);
  svg.addEventListener("pointercancel", hide);
  // pointerdown нужен касанию: у пальца нет «наведения», первое значение
  // обязано появиться от тапа, дальше ведёт то же pointermove.
  svg.addEventListener("pointerdown", show);
  svg.addEventListener("pointermove", show);

  figure.querySelectorAll("[data-toggle]").forEach((button) =>
    button.addEventListener("click", () => {
      const key = button.dataset.toggle;
      const nowOff = !off.has(key);
      if (nowOff) off.add(key);
      else off.delete(key);
      button.setAttribute("aria-pressed", String(!nowOff));
      svg.querySelectorAll(`[data-series="${key}"]`).forEach((group) => {
        group.style.display = nowOff ? "none" : "";
      });
      hide();
    }),
  );

  drawLines(svg);
}

function grid(y) {
  return [0, 50, 100]
    .map(
      (value) => `
        <line class="chart__grid" x1="${PAD.left}" y1="${y(value)}" x2="${W - PAD.right}" y2="${y(value)}" />
        <text class="chart__axis" x="${PAD.left - 8}" y="${y(value) + 4}" text-anchor="end">${value}</text>
      `,
    )
    .join("");
}

// Ширина символа моноширинного шрифта подписей (11px при сжатии 78%):
// нужна, чтобы предсказать столкновение подписей до отрисовки.
const NOTE_CHAR = 6.4;

/**
 * Метки с подписями в два ряда.
 *
 * «Формула изменена» и «сейчас» встают в сутках друг от друга, и в один ряд
 * их подписи читались как «изменевайчас». Подпись, налезающая на уже
 * поставленную, уходит строкой ниже — обрезать или прятать их нельзя:
 * подписи объясняют скачки, ради которых метки и рисуются.
 */
function markers(marks, x, now) {
  const rowEnds = [-Infinity, -Infinity];
  return marks
    .map((mark) => {
      const isNow = mark.time === now;
      const left = x(mark.time) + 5;
      const row = left >= rowEnds[0] ? 0 : left >= rowEnds[1] ? 1 : 0;
      rowEnds[row] = left + mark.label.length * NOTE_CHAR + 10;
      return `
        <line class="chart__mark ${isNow ? "chart__mark--now" : ""}"
          x1="${x(mark.time)}" y1="${PAD.top - 4}" x2="${x(mark.time)}" y2="${H - PAD.bottom}" />
        <text class="chart__note" x="${left}" y="${row ? 24 : 12}">${escapeHtml(mark.label)}</text>
      `;
    })
    .join("");
}

/** Линия рвётся на пропусках: соединять «нет данных» с числом значит выдумать данные. */
function seriesPath(series, points, x, y, now, forecastEnd) {
  const segments = [];
  let current = [];
  for (const point of points) {
    const value = point[series.key];
    if (value === null || value === undefined) {
      if (current.length) segments.push(current);
      current = [];
      continue;
    }
    current.push(`${x(point.time)},${y(value)}`);
  }
  if (current.length) segments.push(current);
  if (!segments.length) return "";

  const solid = segments
    .filter((segment) => segment.length > 1)
    .map(
      (segment) =>
        `<polyline class="chart__line" points="${segment.join(" ")}" stroke="${series.color}" />`,
    )
    .join("");

  const dots = segments
    .filter((segment) => segment.length === 1)
    .map((segment) => {
      const [cx, cy] = segment[0].split(",");
      return `<circle cx="${cx}" cy="${cy}" r="4" fill="${series.color}" />`;
    })
    .join("");

  return solid + dots + forecast(series, points, x, y, now, forecastEnd);
}

function forecast(series, points, x, y, now, forecastEnd) {
  const known = points.filter(
    (point) => point[series.key] !== null && point[series.key] !== undefined,
  );
  if (known.length < 2) return "";
  const tail = known.slice(-FIT_POINTS);
  const slope = fitSlope(tail, series.key);
  const last = tail[tail.length - 1];
  const projected = clamp(last[series.key] + slope * (forecastEnd - last.time));
  return `<polyline class="chart__line chart__line--forecast"
    points="${x(now)},${y(last[series.key])} ${x(forecastEnd)},${y(projected)}"
    stroke="${series.color}" />`;
}

function fitSlope(tail, key) {
  const meanX = tail.reduce((sum, p) => sum + p.time, 0) / tail.length;
  const meanY = tail.reduce((sum, p) => sum + p[key], 0) / tail.length;
  let top = 0;
  let bottom = 0;
  for (const point of tail) {
    top += (point.time - meanX) * (point[key] - meanY);
    bottom += (point.time - meanX) ** 2;
  }
  return bottom === 0 ? 0 : top / bottom;
}

function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

/** Прямые подписи у правого края: значение читается без возврата к легенде. */
function endLabel(series, points, x, y) {
  const known = points.filter(
    (point) => point[series.key] !== null && point[series.key] !== undefined,
  );
  if (!known.length) return "";
  const last = known[known.length - 1];
  return `
    <circle cx="${x(last.time)}" cy="${y(last[series.key])}" r="4.5"
      fill="${series.color}" stroke="var(--card)" stroke-width="2" />
    <text class="chart__value" x="${W - PAD.right + 12}" y="${y(last[series.key]) + 4}">
      ${series.label} ${last[series.key]}
    </text>
  `;
}

function table(points) {
  const rows = points
    .slice(-14)
    .reverse()
    .map(
      (point) => `
        <tr>
          <td>${escapeHtml(dateLabel(point.ts))}</td>
          ${SERIES.map((series) => `<td>${point[series.key] ?? "—"}</td>`).join("")}
          <td>${point.opportunity ?? "—"}</td>
        </tr>
      `,
    )
    .join("");
  return `
    <table>
      <thead>
        <tr>
          <th>Дата</th>
          ${SERIES.map((series) => `<th>${series.label}</th>`).join("")}
          <th>Opportunity</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function ariaLabel(trend, points) {
  const last = points[points.length - 1];
  return escapeHtml(
    `Динамика тренда ${trend.title}: Trend ${last.trend ?? "нет данных"}, ` +
      `Search ${last.search ?? "нет данных"}, Competition ${last.competition ?? "нет данных"}. ` +
      `Значения по датам — в таблице под графиком.`,
  );
}
