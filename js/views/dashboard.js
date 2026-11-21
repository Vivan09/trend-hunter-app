// Раздел «Дашборд»: что изменилось со вчера (FR-025).
//
// Сводка отвечает на один вопрос — стоит ли сегодня вообще открывать список.
// Поэтому наверху не общее число трендов, а те три величины, которые меняют
// поведение: сколько новых, сколько ускорилось, сколько свободных ниш.

import { getTrends } from "../api.js";
import {
  escapeHtml,
  html,
  raw,
  daysSince,
  timeLabel,
  plural,
} from "../format.js";
import { findCard } from "./trends.js";
import { OK, eligibilityOf, isListed } from "../eligibility.js";
import { stagger } from "../motion.js";
import { nextRunLine, staleHours, STALE_AFTER_HOURS } from "../components/schedule.js";
import { skeleton, skelTiles, skelCards } from "../components/skeleton.js";

const NEW_DAYS = 7;
const RISING_GROWTH = 62;
const TOP_LIMIT = 5;

export async function dashboardView(mount) {
  mount.insertAdjacentHTML(
    "beforeend",
    html`
      <header class="view-head">
        <div>
          <p class="eyebrow">Обзор</p>
          <h1 class="view-title">Что нового</h1>
        </div>
        <p class="runline" id="runline">Загружаю…</p>
      </header>
      <div id="body">${raw(skeleton(skelTiles(4), skelCards(5)))}</div>
    `,
  );

  const body = mount.querySelector("#body");
  try {
    const payload = await getTrends({ sort: "opportunity_v2" });
    mount.querySelector("#runline").innerHTML = runline(payload.run);
    body.innerHTML = payload.trends.length ? overview(payload) : emptyState();
    body.querySelectorAll(".rise-list").forEach((list) => stagger(list));
  } catch (error) {
    mount.querySelector("#runline").textContent = "";
    body.innerHTML = html`<div class="alert">${error.message}</div>`;
  }
}

// Экспорт ради теста: класс ошибки «разметка ушла текстом» ловится только
// проверкой строки, вьюхи глазами не перечитывают (урок regiontable).
export function runline(run, now = new Date()) {
  // Расписание живёт и при пустой базе: «когда будут данные» — единственный
  // вопрос, на который пустой Обзор вообще может ответить.
  const next = nextRunLine(run.schedule);
  const tail = next ? ` · ${next}` : "";
  if (!run.finished_at) return `Прогонов ещё не было${tail}`;
  const degraded = run.degraded
    ? ' · <span class="tag tag--warn">прогон неполный</span>'
    : "";
  const blind = Object.entries(run.blind || {})
    .map(([name, label]) => ` · <span class="tag tag--warn">${escapeHtml(sourceName(name))}: ${escapeHtml(label)}</span>`)
    .join("");
  const cover = coverageText(run.coverage);
  const coverage = cover ? ` · <span class="note">${escapeHtml(cover)}</span>` : "";
  const age = staleHours(run.finished_at, now);
  const stale = age !== null && age > STALE_AFTER_HOURS
    ? ` · <span class="tag tag--warn">данные устарели: ${age} ч</span>`
    : "";
  return `Последний прогон: <b>${timeLabel(run.finished_at)}</b>${degraded}${blind}${stale}${coverage}${tail}`;
}

// Имена источников для человека (как в дайджесте); неизвестное печатается как есть.
const SOURCE_NAMES = {
  tiktok: "TikTok", youtube: "YouTube", twitch: "Twitch", twitch_chat: "чат Twitch",
  reddit: "Reddit", kym: "Know Your Meme", roblox: "Roblox", gtrends_daily: "Google Trends",
};
const sourceName = (name) => SOURCE_NAMES[name] || name;

/**
 * Строка покрытия за 30 дней (Р2), та же, что в дайджесте: перерывы, слепые источники, пустой
 * чат. Нет ни одной части: пусто. Экспорт ради теста.
 */
export function coverageText(cover) {
  if (!cover || typeof cover !== "object") return "";
  const runs = Number(cover.runs) || 0;
  const parts = [];
  const gaps = Array.isArray(cover.gaps) ? cover.gaps : [];
  if (gaps.length) {
    const hours = gaps.map((gap) => `${Math.round(Number(gap.hours) || 0)} ч`).join(", ");
    parts.push(`перерывов ${gaps.length} (${hours})`);
  }
  for (const [name, count] of Object.entries(cover.blind || {})) {
    if (count) parts.push(`${sourceName(name)} не прочитан в ${count} из ${runs} прогонов`);
  }
  if (cover.chat_empty) parts.push(`чат Twitch пуст в ${cover.chat_empty} из ${runs} прогонов`);
  return parts.length ? `За ${Number(cover.days) || 0} дней: ${parts.join(", ")}` : "";
}

/**
 * Встречена ли строка этим прогоном: встреча пишет в `last_seen` момент прогона (Р1).
 *
 * Счётчик на это больше не отвечает: он считает только зрячие прогоны, и в слепой
 * прогон ноль стоит и у строки, которую прогон не видел. Нет момента прогона или
 * даты строки (старый trends.json): прежнее правило, без `runs_missing` — встречена.
 * Тот же вопрос, что `digest._seen_this_run`.
 */
function seenThisRun(row, seenAt) {
  if (seenAt && row.last_seen) return row.last_seen === seenAt;
  return !(row.runs_missing > 0);
}

/**
 * Что показывают плитки и «Лучшие возможности дня».
 *
 * Пятёрка лучших — из основного списка (`isListed`: активные, не «одни
 * новости дня», класс ok), как блок дайджеста: до 2026-11-04 её возглавляли
 * Hermitcraft, lsplash и alanzoka — реальные люди и чужая франшиза. Плитки
 * свободных ниш, новых и растущих тоже считают только допущенных: свободная
 * ниша у чужого бренда — не возможность, а новые и растущие до финального
 * ревью P0 считали и людей с мусором (29 из 122 и 123 из 162 на копии базы).
 * Растущие — ещё и только встреченные этим прогоном, как блок роста
 * дайджеста: рост у невстреченного заморожен (141 из 162 строк плитки).
 * Порядок пятёрки — тот, что прислал сервер.
 */
export function overviewRows(trends, seenAt = "") {
  const listed = trends.filter(isListed);
  const admitted = trends.filter((row) => eligibilityOf(row) === OK);
  return {
    fresh: admitted.filter((row) => {
      const age = daysSince(row.first_seen);
      return age !== null && age <= NEW_DAYS;
    }),
    rising: admitted.filter(
      (row) => (row.growth ?? 0) >= RISING_GROWTH && seenThisRun(row, seenAt),
    ),
    free: trends.filter(
      (row) => row.verified && row.niche_free && eligibilityOf(row) === OK,
    ),
    top: listed
      .filter((row) => row.opportunity_v2 !== null && row.opportunity_v2 !== undefined)
      .slice(0, TOP_LIMIT),
    unverified: listed.filter((row) => !row.verified),
  };
}

// Экспорт ради теста, как у `runline`.
export function overview(payload) {
  const trends = payload.trends;
  const { fresh, rising, free, top, unverified } = overviewRows(trends, payload.run?.seen_at);

  return html`
    <div class="tiles rise-list">
      ${raw(tile(fresh.length, `${plural(fresh.length, "новый тренд", "новых тренда", "новых трендов")} за неделю`))}
      ${raw(tile(rising.length, "набирают скорость"))}
      ${raw(tile(free.length, "со свободной нишей (старая формула)", true))}
      ${raw(tile(trends.length, "всего в базе"))}
    </div>

    <section class="section">
      <div class="section__head">
        <h2 class="eyebrow">Лучшие возможности дня</h2>
        <a class="runline" href="#/trends">весь список →</a>
      </div>
      ${raw(
        top.length
          ? html`<ul class="finds rise-list">
              ${raw(top.map((row) => findCard(row, payload.bands || null, undefined, { warnDays: payload.run?.measure_warn_days })).join(""))}
            </ul>`
          : html`<div class="panel">
              Проверенных трендов пока нет — Возможность появится после проверки
              магазина. Ждут очереди: ${unverified.length}.
            </div>`,
      )}
    </section>
  `;
}

function tile(value, label, accent = false) {
  return html`
    <div class="tile ${raw(accent ? "tile--accent" : "")}">
      <p class="tile__value">${value}</p>
      <p class="tile__label">${label}</p>
    </div>
  `;
}

function emptyState() {
  return html`
    <div class="empty">
      <b>База знаний пуста</b>
      <p>
        Запусти прогон — <code>python -m trendhunter.pipeline</code> — и тренды
        появятся здесь вместе с историей.
      </p>
    </div>
  `;
}
