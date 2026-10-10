// Пять показателей одной полосой.
//
// Прочерк вместо нуля — принципиально: отсутствие данных не должно выглядеть
// как факт «спроса нет» (FR-016). Подпись под прочерком объясняет, почему его
// нельзя посчитать, — иначе пользователь решит, что система сломалась.

import { html, raw, score } from "../format.js";

// Спрос разложен на две половины (2026-08-05). Одно число «Search 84» не
// отвечало на первый вопрос человека: ищут это в магазине или только в вебе.
// Разница решает, стоит ли делать игру, — «Throw a Coin» имел десять
// веб-подсказок и ноль в Play, и по общему баллу это было неотличимо.
const METRICS = [
  { key: "trend", label: "Trend", hint: "сила сигнала в источниках сейчас" },
  {
    key: "play",
    label: "Play",
    hint:
      "спрос в Google Play: с какого короткого префикса имя всплывает в " +
      "подсказках магазина (у записей до 2026-08-16 — счёт подсказок). " +
      "Весит 0.7 спроса",
    // Сырые значения важнее балла: «всплывает с 4 из 15 букв» объясняет
    // число лучше любой подписи. Счёт подсказок остаётся у прежних записей.
    note: (row) => {
      const probe = row.demand_prefix;
      if (probe && "found_at" in probe) {
        if (probe.found_at === null) return "не всплывает в подсказках";
        return `всплывает с ${probe.found_at} из ${probe.term_len} букв (стор ${probe.locale})`;
      }
      return row.play_count === null || row.play_count === undefined
        ? ""
        : `${row.play_count} подсказ${suffix(row.play_count)}`;
    },
  },
  {
    key: "interest",
    label: "Trends",
    hint: "веб-интерес Google Trends относительно собственного пика имени. Весит 0.3",
  },
  { key: "search", label: "Спрос", hint: "0.7·Play + 0.3·Trends — то, что идёт в формулу" },
  { key: "growth", label: "Growth", hint: "скорость: 50 — плато" },
  { key: "competition", label: "Compet.", hint: "насколько занята ниша" },
  { key: "gameability", label: "Game", hint: "превращаемость в игру" },
];

/** Окончание для «подсказка/подсказки/подсказок». */
function suffix(count) {
  const tail = count % 100;
  if (tail >= 11 && tail <= 14) return "ок";
  const last = count % 10;
  if (last === 1) return "ка";
  if (last >= 2 && last <= 4) return "ки";
  return "ок";
}

export function scorebar(row, { className = "scorebar" } = {}) {
  return html`<dl class="${raw(className)}">
    ${raw(METRICS.map((metric) => cell(metric, row)).join(""))}
  </dl>`;
}

function cell({ key, label, hint, note }, row) {
  const value = row[key];
  const empty = value === null || value === undefined;
  const under = empty || !note ? "" : note(row);
  return html`
    <div class="metric" title="${hint}">
      <dt class="metric__label">${label}</dt>
      <dd class="metric__value ${raw(empty ? "metric__value--none" : "")}">${score(value)}</dd>
      ${raw(under ? html`<dd class="metric__note">${under}</dd>` : "")}
    </div>
  `;
}

/** Расшифровка состояний под шапкой тренда. */
export function scoreNotes(row) {
  const notes = [];
  if (row.verified !== true) {
    notes.push(
      "Магазин ещё не проверен, поэтому Search, Competition и Opportunity пусты. " +
        "Проверка идёт в следующем прогоне: за раз проверяется ограниченное число трендов.",
    );
  }
  if (row.search_partial) {
    notes.push(
      "Спрос посчитан по одному Google Play: Trends не ответил. Сам спрос " +
        "замерен — не хватает только уточнения, которое весит 0.3.",
    );
  }
  if (!notes.length) return "";
  return html`<div class="notes">
    ${raw(notes.map((note) => html`<p class="note">${note}</p>`).join(""))}
  </div>`;
}
