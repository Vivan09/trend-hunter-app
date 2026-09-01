// Сортировка, фильтры и листание для длинных списков (FR-034).
//
// До фичи 004 прогон приносил шесть трендов, и список можно было показывать
// целиком. Теперь их сотни: без порядка и фильтра список перестаёт быть
// инструментом выбора, а без листания страница начинает тормозить (SC-019).
//
// Модуль общий для трендов и кандидатов: разное у них только чем сортировать,
// поэтому сравнители приходят снаружи, а вся обвязка — здесь.

import { html, raw } from "../format.js";

export const PER_PAGE = 24;

/** Состояние списка. Живёт в модуле раздела, чтобы переживать перерисовку. */
export function makeState(sort) {
  return { sort, page: 1, filters: {}, query: "" };
}

/** Выбран ли хоть один фильтр. Нужно, чтобы пустая выдача назвала причину. */
export function hasActiveFilter(state) {
  return Object.values(state.filters).some((value) => value && value !== "all");
}

export function listControls(state, { sorts, filters = [], total = 0, shown = 0 }) {
  return html`
    <div class="controls" role="group" aria-label="Порядок и фильтры">
      <label class="controls__field">
        <span class="controls__label">Порядок</span>
        <select name="sort" data-sort-select>
          ${raw(options(sorts, state.sort))}
        </select>
      </label>
      ${raw(
        filters
          .map(
            (filter) => html`
              <label class="controls__field">
                <span class="controls__label">${filter.label}</span>
                <select name="${filter.key}" data-filter="${filter.key}">
                  ${raw(options(filter.options, state.filters[filter.key] || "all"))}
                </select>
              </label>
            `,
          )
          .join(""),
      )}
      <p class="controls__count" role="status">
        ${raw(countLabel(shown, total))}
      </p>
    </div>
  `;
}

/**
 * Пояснение, что показано только похожее.
 *
 * Догадка не должна выглядеть как попадание: если точных совпадений нет вовсе,
 * человек обязан узнать об этом до того, как решит, что имя в базе есть.
 */
export function guessNote(matches, query) {
  if (!query || !matches.length) return "";
  if (!matches.every((match) => match.kind === "fuzzy")) return "";
  return html`<p class="guess">
    Точных совпадений с «${query}» нет — показано похожее.
  </p>`;
}

/**
 * Пустая выдача называет причину сужения. Их две, и по одной надписи
 * «под фильтр никто не подошёл» не понять, что список опустошил запрос.
 */
export function emptyList(state, noun) {
  const byQuery = Boolean(state.query);
  const byFilter = hasActiveFilter(state);
  const title = byQuery
    ? byFilter
      ? html`Ничего под запрос «${state.query}» и текущие фильтры`
      : html`Ничего под запрос «${state.query}»`
    : "Под фильтр никто не подошёл";
  return html`<div class="empty">
    <b>${raw(title)}</b>
    <p>Смягчи условия — ${noun} никуда не делись.</p>
  </div>`;
}

function countLabel(shown, total) {
  if (!total) return "ничего не найдено";
  if (shown === total) return `${total} · показаны все`;
  return `${total} · на странице ${shown}`;
}

function options(items, active) {
  return items
    .map(
      (item) => html`
        <option value="${item.value}" ${raw(item.value === active ? "selected" : "")}>
          ${item.label}
        </option>
      `,
    )
    .join("");
}

/** Фильтрация по значению поля: `all` пропускает всё. */
export function applyFilters(rows, state, filters) {
  return filters.reduce((kept, filter) => {
    const value = state.filters[filter.key] || "all";
    return value === "all" ? kept : kept.filter((row) => filter.match(row, value));
  }, rows);
}

/**
 * Сортировка. Пустое значение всегда уезжает вниз: у непроверенного тренда
 * показателя нет, и притворяться нулём он не должен — иначе «наименьшая
 * конкуренция» возглавят те, кого никто не мерил.
 */
export function applySort(rows, comparator) {
  return [...rows].sort(comparator);
}

// Ничьи разводит дата встречи, а не алфавит (2026-08-05). Замер: 17 трендов
// делили сигнал 68 — Adopt Me!, Alan Walker, Erling Haaland, — и наверх
// попадали те, чей слаг начинается с «A». Свежая встреча — единственный
// осмысленный ответ на вопрос «кто из равных важнее сейчас»; слаг остаётся
// последним рубежом, чтобы порядок был воспроизводим.
function tieBreak(a, b) {
  return String(b.last_seen || "").localeCompare(String(a.last_seen || ""))
    || String(a.slug).localeCompare(String(b.slug));
}

export function byNumberDesc(field) {
  return (a, b) => rank(b[field]) - rank(a[field]) || tieBreak(a, b);
}

export function byNumberAsc(field) {
  return (a, b) => {
    const left = a[field];
    const right = b[field];
    if (left === null || left === undefined) return 1;
    if (right === null || right === undefined) return -1;
    return left - right || tieBreak(a, b);
  };
}

export function byDateDesc(field) {
  return (a, b) => String(b[field] || "").localeCompare(String(a[field] || ""));
}

function rank(value) {
  return value === null || value === undefined ? -1 : value;
}

export function paginate(rows, state, perPage = PER_PAGE) {
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const page = Math.min(Math.max(1, state.page), pages);
  state.page = page;
  return { rows: rows.slice((page - 1) * perPage, page * perPage), page, pages };
}

export function pager({ page, pages }) {
  if (pages < 2) return "";
  return html`
    <nav class="pager" aria-label="Страницы списка">
      <button type="button" data-page="${page - 1}" ${raw(page === 1 ? "disabled" : "")}>
        ← назад
      </button>
      <span class="pager__now">${page} из ${pages}</span>
      <button type="button" data-page="${page + 1}" ${raw(page === pages ? "disabled" : "")}>
        вперёд →
      </button>
    </nav>
  `;
}

/** Связывает переключатели с состоянием. `onChange` перерисовывает раздел. */
export function bindListControls(root, state, onChange) {
  root.querySelector("[data-sort-select]")?.addEventListener("change", (event) => {
    state.sort = event.target.value;
    state.page = 1;
    onChange();
  });
  root.querySelectorAll("[data-filter]").forEach((select) => {
    select.addEventListener("change", (event) => {
      state.filters[select.dataset.filter] = event.target.value;
      state.page = 1;
      onChange();
    });
  });
  root.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      state.page = Number(button.dataset.page);
      onChange();
    });
  });
}
