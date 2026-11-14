// Блок «Поиск в Google» на карточке тренда (Keyword Planner, 2026-11-05).
//
// Рисуется не `chart.js`: у него одна ось 0–100, а здесь абсолютные запросы
// в месяц. Двенадцать столбиков — простая вёрстка, без зависимостей.
//
// Месяц без замера (`null`) — пустой штрихованный слот с подписью «нет
// данных», а не столбик нулевой высоты: «Google не отдал месяц» и «в месяц
// не искали» — разные утверждения (конституция II).

import { html, raw, roundHalfEven, volumeLabel } from "../format.js";

const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

// Именительный — для «Последний месяц у Google — сентябрь 2026»: родительный
// из «с января 2019» давал там «данные по сентября» (финальное ревью, 2026-11-05).
const MONTHS_NOMINATIVE = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

const AVG_MONTHS = 3;

/** «2019-01» → «января 2019»; нераспознанное возвращается как есть. */
function monthPhrase(ym, names = MONTHS_GENITIVE) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(ym || ""));
  if (!match) return String(ym ?? "");
  return `${names[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

/**
 * Поиск по миру в месяц — зеркало Python `search_volume.volume`: среднее трёх
 * последних известных месяцев, дыры пропускаются, ничья — к чётному.
 * `null` — замера нет или он испорчен, не ноль (конституция II).
 *
 * Строка «Весь мир» на карточке (финальное ревью, 2026-11-05): мировое число
 * было только в подсказках столбиков, а на телефоне и в Mini App их не видно.
 */
export function worldVolume(sv) {
  const ww = sv?.status === "ok" ? sv.ww : null;
  const months = ww && typeof ww === "object" && Array.isArray(ww.months) ? ww.months : null;
  if (!months) return null;
  const known = months.filter((v) => v !== null && v !== undefined).slice(-AVG_MONTHS);
  if (!known.length) return null;
  return roundHalfEven(known.reduce((sum, v) => sum + v, 0) / known.length);
}

/** Метки двенадцати месяцев, заканчивая `last` («2026-09» → 2025-10 … 2026-09). */
function monthKeys(last, count) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(last || ""));
  if (!match) return Array(count).fill("");
  const end = Number(match[1]) * 12 + Number(match[2]) - 1;
  return Array.from({ length: count }, (_, i) => {
    const index = end - (count - 1 - i);
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
  });
}

function spaced(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function bars(months, last) {
  const keys = monthKeys(last, months.length);
  const peak = Math.max(1, ...months.filter((v) => v !== null && v !== undefined));
  const cells = months.map((value, i) => {
    if (value === null || value === undefined) {
      return html`<li class="svbar svbar--gap" title="${keys[i]}: нет данных"><span></span></li>`;
    }
    const height = Math.max(2, Math.round((value / peak) * 100));
    return html`<li class="svbar" title="${keys[i]}: ${spaced(value)} в месяц"><span style="height:${height}%"></span></li>`;
  });
  return html`<ol class="svbars" aria-label="Поиск в Google по месяцам">${raw(cells.join(""))}</ol>`;
}

function lagNote(sv, now) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(sv.last_month || ""));
  const at = now instanceof Date ? now : new Date(now ?? Date.now());
  let behind = "";
  if (match && !Number.isNaN(at.getTime())) {
    const months = at.getUTCFullYear() * 12 + at.getUTCMonth() - (Number(match[1]) * 12 + Number(match[2]) - 1);
    if (months > 0) behind = ` Последний месяц у Google — ${monthPhrase(sv.last_month, MONTHS_NOMINATIVE)}.`;
  }
  return html`<p class="note">Данные Google отстают на 1–2 месяца: свежий месяц приходит не сразу.${behind}</p>`;
}

/**
 * @param {object|null} sv `trend.search_volume`
 * @param {Date|string} now момент показа — для пометки об отставании данных
 */
export function searchVolumeBlock(sv, now = new Date()) {
  if (!sv) return "";
  if (sv.status === "no_data" || !sv.ww) {
    return html`
      <p>Google: нет данных по «${sv.keyword}».</p>
      ${raw(lagNote(sv, now))}
    `;
  }
  const ww = sv.ww;
  const months = ww.months || [];
  // Первый месяц выше порога — первый месяц окна из 48: имя искали уже тогда,
  // и «с октября 2022» про вечное имя было бы неправдой (финальное ревью,
  // 2026-11-05; та же оговорка — в `proven.reasons`).
  const earlier = ww.first_hit && ww.first_hit === ww.since ? " или раньше" : "";
  const hit = ww.first_hit
    ? `в поиске Google с ${monthPhrase(ww.first_hit)}${earlier}`
    : `не достигал ${spaced(ww.threshold ?? 1000)} в месяц`;
  const rows = [];
  const world = worldVolume(sv);
  if (world !== null) {
    rows.push(html`<tr><td>Весь мир</td><td>${volumeLabel(world)}/мес</td></tr>`);
  }
  if (sv.cis?.avg3 !== null && sv.cis?.avg3 !== undefined) {
    rows.push(html`<tr><td>Украина+Казахстан+Беларусь</td><td>${volumeLabel(sv.cis.avg3)}/мес</td></tr>`);
  }
  if (sv.us?.avg3 !== null && sv.us?.avg3 !== undefined) {
    rows.push(html`<tr><td>США</td><td>${volumeLabel(sv.us.avg3)}/мес</td></tr>`);
  }
  return html`
    ${raw(sv.variant_of ? html`<p class="note">Google объединил с «${sv.variant_of}».</p>` : "")}
    ${raw(bars(ww.months || [], sv.last_month))}
    <p>${hit}${raw(ww.since ? html` <span class="note">(история с ${monthPhrase(ww.since)})</span>` : "")}</p>
    ${raw(rows.length ? html`<table class="svtable"><tbody>${raw(rows.join(""))}</tbody></table>` : "")}
    <p class="note">Среднее за 3 последних месяца.</p>
    ${raw(months.some((v) => v === null || v === undefined) ? html`<p class="note">штрих — месяц без данных</p>` : "")}
    ${raw(lagNote(sv, now))}
  `;
}
