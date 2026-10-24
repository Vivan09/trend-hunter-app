// Раздел «Кандидаты»: встреченное, но ещё не подтверждённое (FR-021, FR-022).
//
// Список нарочно не похож на список трендов. У кандидата нет ни одного
// показателя — он не расходует лимит обращений к магазину (FR-024), — и рисовать
// ему наклейку с баллом значило бы показать оценку, которой не существует.
// Поэтому здесь факты встречи: сколько прогонов, сколько упоминаний, откуда
// и когда впервые. Кнопка генерации идей отсутствует по той же причине:
// придумывать игру по одному упоминанию не о чем (FR-021).

import { getCandidates, getTrends, isReadOnly, promoteCandidate } from "../api.js";
import { html, raw, dateLabel, contentTypeLabel, plural } from "../format.js";
import { stagger } from "../motion.js";
import { skeleton, skelCards } from "../components/skeleton.js";
import {
  applyFilters,
  applySort,
  bindListControls,
  byDateDesc,
  byNumberDesc,
  emptyList,
  guessNote,
  listControls,
  makeState,
  paginate,
  pager,
} from "../components/listcontrols.js";
import { regionFilter } from "../components/regionfilter.js";
import { sourceFilter } from "../components/sourcefilter.js";
import { bindSearchBox, searchBox } from "../components/searchbox.js";
import { searchRows } from "../search/match.js";
import { queryParam, setQueryParam } from "../router.js";

const SORTS = [
  { value: "runs", label: "по числу прогонов" },
  { value: "mentions", label: "по числу упоминаний" },
  { value: "first_seen", label: "по дате первой встречи" },
  { value: "last_seen", label: "по дате последней встречи" },
];

const COMPARATORS = {
  // При равном числе прогонов решает число упоминаний, а не алфавит:
  // у большинства кандидатов прогон один, и алфавитный порядок прятал бы
  // самых заметных в середине списка.
  runs: (a, b) =>
    (b.runs_seen || 0) - (a.runs_seen || 0) ||
    (b.mentions_count || 0) - (a.mentions_count || 0) ||
    String(a.name).localeCompare(String(b.name)),
  mentions: byNumberDesc("mentions_count"),
  first_seen: byDateDesc("first_seen"),
  last_seen: byDateDesc("last_seen"),
};

const FILTERS = [
  {
    key: "type",
    label: "Тип",
    options: [
      { value: "all", label: "любой" },
      { value: "character", label: "персонажи" },
      { value: "meme", label: "мемы" },
      { value: "game", label: "игры" },
      { value: "format", label: "форматы" },
      { value: "phrase", label: "фразы" },
      { value: "other", label: "прочее" },
    ],
    match: (row, value) => (row.type || "other") === value,
  },
  {
    key: "origin",
    label: "Происхождение",
    options: [
      { value: "all", label: "любое" },
      { value: "source", label: "из источников" },
      { value: "unglued", label: "выброшенные" },
    ],
    // «Выброшенные» — имена, отклеенные от чужого тренда при разборе
    // накопленных синонимов (спека 2026-08-17). До разбора у brainrot
    // среди синонимов лежали World of Tanks и Paw Patrol, а у
    // a-broken-dream — DELTARUNE и Scott Cawthon: каждое такое имя —
    // проглоченный тренд со своей историей.
    match: (row, value) =>
      value === "unglued" ? row.origin === "unglued" : !row.origin,
  },
  // Фильтр по источнику переехал в общий компонент sourcefilter.js: зашитый
  // здесь список прожил сутки без twitch_chat — варианты обязаны собираться
  // из данных, как у региона.
];

const state = makeState("runs");
let rows = [];

// Тренды — только ради строки «в трендах ещё N» в подсказках (дизайн, раздел 5).
let trendRows = null;
let trendsFailed = false;
let search = null;

export async function candidatesView(mount) {
  const savedRegion = queryParam("region");
  if (savedRegion) state.filters.region = savedRegion;
  state.query = queryParam("q");
  mount.insertAdjacentHTML(
    "beforeend",
    html`
      <header class="view-head">
        <div>
          <p class="eyebrow">Ещё не подтверждено</p>
          <h1 class="view-title">Кандидаты</h1>
        </div>
      </header>
      <p class="runline">
        Имя, встреченное впервые, живёт здесь. Оно станет трендом само — при
        встрече во втором источнике, в пяти роликах, во втором прогоне или
        когда окажется, что имя уже занято крупной игрой в Google Play, —
        либо тогда, когда ты повысишь его вручную.
      </p>
      ${raw(
        searchBox({
          id: "candidates",
          placeholder: "имя кандидата, «/» — фокус",
          value: state.query,
        }),
      )}
      <div class="section" id="candidates" aria-busy="true">
        <p class="sr-only" role="status">Загружаю…</p>
        ${raw(skeleton(skelCards(6)))}
      </div>
    `,
  );

  const target = mount.querySelector("#candidates");
  try {
    rows = await getCandidates();
  } catch (error) {
    target.removeAttribute("aria-busy");
    target.innerHTML = html`<div class="alert">${error.message}</div>`;
    return;
  }
  target.removeAttribute("aria-busy");
  bindSearch(mount, target);
  render(target);
  loadTrends();
}

function bindSearch(mount, target) {
  const apply = (query) => {
    state.query = query;
    state.page = 1;
    setQueryParam("q", query, "");
    render(target);
  };
  search = bindSearchBox(mount, {
    id: "candidates",
    rows: () => rows,
    field: "name",
    meta: (row) =>
      `${contentTypeLabel(row.type)} · ${row.runs_seen || 0} ${plural(
        row.runs_seen || 0,
        "прогон",
        "прогона",
        "прогонов",
      )}`,
    neighbour: neighbourLine,
    onQuery: apply,
    // Своей страницы у кандидата нет, вести некуда: выбор оставляет в списке
    // одну карточку — с кнопкой «↑ В тренды» под рукой.
    onPick: (row) => {
      search?.setValue(row.name);
      apply(row.name);
    },
  });
}

async function loadTrends() {
  if (trendRows || trendsFailed) return;
  try {
    const payload = await getTrends();
    trendRows = payload.trends;
  } catch {
    trendsFailed = true;
  }
}

function neighbourLine(query, own) {
  if (trendsFailed) return { text: "в трендах — не проверил, сервер молчит" };
  if (!trendRows) return null;
  const count = searchRows(trendRows, query, { field: "title" }).length;
  if (!count) return null;
  return {
    text: `в трендах ${own ? "ещё " : ""}${count}`,
    href: `#/trends?q=${encodeURIComponent(query)}`,
  };
}

function render(target) {
  const filters = [...FILTERS, sourceFilter(rows), regionFilter(rows)];
  const found = searchRows(rows, state.query, { field: "name" });
  const filtered = applyFilters(
    found.map((match) => match.row),
    state,
    filters,
  );
  const sorted = applySort(filtered, COMPARATORS[state.sort] || COMPARATORS.runs);
  const page = paginate(sorted, state);

  target.innerHTML = rows.length
    ? html`
        ${raw(
          listControls(state, {
            sorts: SORTS,
            filters,
            total: filtered.length,
            shown: page.rows.length,
          }),
        )}
        ${raw(guessNote(found, state.query))}
        ${raw(
          page.rows.length
            ? html`<ul class="candidates rise-list">
                ${raw(page.rows.map(candidateCard).join(""))}
              </ul>`
            : emptyList(state, "кандидаты"),
        )}
        ${raw(pager(page))}
      `
    : html`<div class="empty">
        <b>Кандидатов нет</b>
        <p>
          Все найденные имена уже стали трендами — либо прогон ещё не запускался:
          <code>python -m trendhunter.pipeline</code>
        </p>
      </div>`;

  bindListControls(target, state, () => {
    setQueryParam("region", state.filters.region || "all");
    render(target);
  });
  bindPromote(target);
  stagger(target.querySelector(".rise-list"));
}

export function candidateCard(row) {
  const mentions = row.mentions_count || 0;
  const runs = row.runs_seen || 0;
  return html`
    <li class="candidate" data-slug="${row.slug}">
      <div class="candidate__main">
        <p class="candidate__name">${row.name}</p>
        <div class="find__meta">
          <span class="tag">${contentTypeLabel(row.type)}</span>
          <span class="tag"
            >${runs} ${plural(runs, "прогон", "прогона", "прогонов")}</span
          >
          <span class="tag"
            >${mentions} ${plural(mentions, "упоминание", "упоминания", "упоминаний")}</span
          >
          ${raw(
            (row.sources || [])
              .map((source) => html`<span class="tag">${source}</span>`)
              .join(""),
          )}
        </div>
        <p class="candidate__seen">
          впервые встречен ${dateLabel(row.first_seen)}${raw(
            row.runs_missing
              ? html` · не попадался ${row.runs_missing}
                  ${plural(row.runs_missing, "прогон", "прогона", "прогонов")}`
              : "",
          )}
        </p>
        ${raw(
          row.origin === "unglued" && row.from_trend
            ? html`<p class="candidate__seen">
                отклеено от тренда
                <a href="#/trend/${row.from_trend}">${row.from_trend}</a>
              </p>`
            : "",
        )}
        ${raw(marketTrace(row.market_probe))}
      </div>
      ${raw(
        isReadOnly()
          ? ""
          : html`<button class="cta cta--ghost" type="button" data-promote="${row.slug}">
              ↑ В тренды
            </button>`,
      )}
    </li>
  `;
}

/**
 * Рыночный след кандидата (фича 005).
 *
 * Три состояния, и они не должны сливаться. `null` — зонда не было, и врать
 * нулями нельзя: пусто означает «не проверялось». Ноль приложений — проверено,
 * имя свободно. Есть занявшие — показываем крупнейшего, потому что именно он
 * решает, стоит ли туда идти.
 */
function marketTrace(probe) {
  if (!probe) {
    return html`<p class="candidate__market candidate__market--unknown">
      В магазине ещё не проверялся
    </p>`;
  }
  if (!probe.exact_titles) {
    return html`<p class="candidate__market candidate__market--free">
      Имя в Google Play свободно · в выдаче ${probe.results_count || 0}
    </p>`;
  }
  return html`<p class="candidate__market candidate__market--taken">
    Имя занято: ${probe.exact_titles}
    ${plural(probe.exact_titles, "игра", "игры", "игр")} · крупнейшая
    «${probe.top_exact_title}», ${installsLabel(probe.top_exact_installs)}
  </p>`;
}

function installsLabel(installs) {
  const value = Number(installs) || 0;
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)} млн установок`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} тыс. установок`;
  return `${value} установок`;
}

/**
 * Повышение. Отказ показывается текстом: 409 означает, что тренд с таким
 * именем уже есть, и молчать об этом нельзя (конституция II).
 */
function bindPromote(target) {
  target.querySelectorAll("[data-promote]").forEach((button) => {
    button.addEventListener("click", async () => {
      const slug = button.dataset.promote;
      button.disabled = true;
      button.textContent = "Повышаю…";
      try {
        await promoteCandidate(slug);
        rows = rows.filter((row) => row.slug !== slug);
        // Повышенное имя уехало в тренды, и список соседа устарел. Оставить
        // старый значило бы молча ответить «в трендах ничего» про имя, которое
        // только что туда и отправили.
        trendRows = null;
        loadTrends();
        render(target);
        search?.refresh();
      } catch (error) {
        button.disabled = false;
        button.textContent = "↑ В тренды";
        button
          .closest(".candidate")
          ?.insertAdjacentHTML("beforeend", html`<p class="alert">${error.message}</p>`);
      }
    });
  });
}
