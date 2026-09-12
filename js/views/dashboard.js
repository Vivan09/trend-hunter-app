// Раздел «Дашборд»: что изменилось со вчера (FR-025).
//
// Сводка отвечает на один вопрос — стоит ли сегодня вообще открывать список.
// Поэтому наверху не общее число трендов, а те три величины, которые меняют
// поведение: сколько новых, сколько ускорилось, сколько свободных ниш.

import { getTrends } from "../api.js";
import {
  html,
  raw,
  daysSince,
  timeLabel,
  plural,
} from "../format.js";
import { findCard } from "./trends.js";
import { stagger } from "../motion.js";
import { nextRunLine } from "../components/schedule.js";
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
    const payload = await getTrends({ sort: "opportunity" });
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
export function runline(run) {
  // Расписание живёт и при пустой базе: «когда будут данные» — единственный
  // вопрос, на который пустой Обзор вообще может ответить.
  const next = nextRunLine(run.schedule);
  const tail = next ? ` · ${next}` : "";
  if (!run.finished_at) return `Прогонов ещё не было${tail}`;
  const degraded = run.degraded
    ? ' · <span class="tag tag--warn">прогон неполный</span>'
    : "";
  return `Последний прогон: <b>${timeLabel(run.finished_at)}</b>${degraded}${tail}`;
}

function overview(payload) {
  const trends = payload.trends;
  const fresh = trends.filter((row) => {
    const age = daysSince(row.first_seen);
    return age !== null && age <= NEW_DAYS;
  });
  const rising = trends.filter((row) => (row.growth ?? 0) >= RISING_GROWTH);
  const free = trends.filter((row) => row.verified && row.niche_free);
  const top = trends.filter((row) => row.opportunity !== null).slice(0, TOP_LIMIT);
  const unverified = trends.filter((row) => !row.verified);

  return html`
    <div class="tiles rise-list">
      ${raw(tile(fresh.length, `${plural(fresh.length, "новый тренд", "новых тренда", "новых трендов")} за неделю`))}
      ${raw(tile(rising.length, "набирают скорость"))}
      ${raw(tile(free.length, "со свободной нишей", true))}
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
              ${raw(top.map(findCard).join(""))}
            </ul>`
          : html`<div class="panel">
              Проверенных трендов пока нет — Opportunity появится после проверки
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
