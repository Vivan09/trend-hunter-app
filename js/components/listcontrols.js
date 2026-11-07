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

/**
 * Доказанный спрос (P0-B, 2026-11-04) — тот же порядок, что
 * `ranking.by_proven_demand` у дайджеста и журнала прогнозов: балл, потом
 * число чужих игр с именем, доказавших установки, потом поиск и сигнал, и
 * лишь затем общая развязка. Балл с одним знаком всё равно даёт ничьи
 * (158 значений на 227 строках), и решать их алфавит не должен. Неизвестный
 * балл — внизу: «не мерили» не притворяется нулём.
 *
 * Неактивные — под активными (финальное ревью P0, 2026-11-04): доказанный
 * спрос, в отличие от Opportunity, с невстречей не затухает, а список держит
 * неактивных (решение 2026-08-08) — умершие тренды стояли на своих местах,
 * 697 из 927 строк, 8-я «Albion Online [неактивен]». Тонут, но не прячутся.
 */
export function byProvenDesc(a, b) {
  return (
    unknown(a.proven_demand) - unknown(b.proven_demand) ||
    gone(a) - gone(b) ||
    rank(b.proven_demand) - rank(a.proven_demand) ||
    games(b) - games(a) ||
    rank(b.search) - rank(a.search) ||
    rank(b.trend) - rank(a.trend) ||
    tieBreak(a, b)
  );
}

/**
 * Порядок вкладки «Возможности» — то же, что `ranking.by_opportunity_v2` (спека O3):
 * без балла в конце, неактивные ниже активных, балл по убыванию, затем сила
 * сигнала, поиск, свежесть встречи и slug. Балл 0 — замер, он выше «нет балла».
 *
 * Регион подменяет `trend` и `search` для показа, а порядок обязан остаться мировым
 * (балл мировой): берутся значения из `row.world`, если они есть. Вектор порядка
 * лежит в tests/js/opportunity.test.js и tests/unit/test_ranking.py.
 */
export function byOpportunityV2(a, b) {
  return (
    unknown(a.opportunity_v2) - unknown(b.opportunity_v2) ||
    gone(a) - gone(b) ||
    rank(b.opportunity_v2) - rank(a.opportunity_v2) ||
    rank(worldOf(b, "trend")) - rank(worldOf(a, "trend")) ||
    unknown(worldOf(a, "search")) - unknown(worldOf(b, "search")) ||
    rank(worldOf(b, "search")) - rank(worldOf(a, "search")) ||
    // Как в Python: свежая встреча раньше, затем slug по кодовым точкам.
    (String(a.last_seen || "") < String(b.last_seen || "") ? 1 : String(a.last_seen || "") > String(b.last_seen || "") ? -1 : 0) ||
    (String(a.slug) < String(b.slug) ? -1 : String(a.slug) > String(b.slug) ? 1 : 0)
  );
}

function worldOf(row, field) {
  return row.world && row.world[field] !== undefined ? row.world[field] : row[field];
}

function games(row) {
  return Number(row.proven_demand_parts?.games) || 0;
}

function unknown(value) {
  return value === null || value === undefined ? 1 : 0;
}

function gone(row) {
  return row.active === false ? 1 : 0;
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

/**
 * Строка попала в «Новое в Google»: только явное `kp_new === true`, как в
 * Python, и только активная (спека 5.4). Индекс неактивным `kp_new` больше
 * не ставит (финальное ревью, 2026-11-05): их не перемеряют, и «новое»
 * горело бы вечно. Проверка здесь — вторая защита на случай старого индекса.
 */
export function isNewInGoogle(row) {
  return row.kp_new === true && row.active !== false;
}

/**
 * «Новое в Google» — тот же порядок, что `ranking.new_in_google`: рост (log2)
 * главный ключ, объём вторичный, затем общая развязка Python `_tiebroken`:
 * поиск, сигнал, свежесть встречи, slug. Python делает это устойчивыми
 * проходами от младшего ключа; здесь тот же результат одним сравнителем.
 * Без поиска и сигнала ничью решала свежесть встречи, и при росте 2 и объёме
 * 1000 дашборд ставил «a, b», а дайджест — «b, a» (финальное ревью,
 * 2026-11-05; вектор — в trendsort.test.js и test_ranking.py). Нет замера —
 * внизу, не ноль (принцип II).
 */
export function byNewInGoogle(a, b) {
  return (
    unknown(a.kp_growth) - unknown(b.kp_growth) ||
    rank(b.kp_growth) - rank(a.kp_growth) ||
    unknown(a.kp_volume) - unknown(b.kp_volume) ||
    rank(b.kp_volume) - rank(a.kp_volume) ||
    rank(b.search) - rank(a.search) ||
    rank(b.trend) - rank(a.trend) ||
    tieBreak(a, b)
  );
}
