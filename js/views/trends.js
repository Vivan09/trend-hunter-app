// Раздел «Тренды»: четыре списка одних и тех же находок (FR-022, FR-023).
//
// Списки не для симметрии — это разные вопросы. «Возможности» отвечают на
// «где свободно при живом спросе», «Спрос × ниша» — на «что стоит ниша, если
// не гнаться за волной», «Из этого выйдет игра» — на «из чего делать»,
// «Громкие сейчас» — на «что сейчас гремит, даже если ниша занята». Громкий
// занятый тренд обязан попадаться на глаза: из него вырастает следующий.
//
// Третий список появился в фиче 011, когда играбельность вышла из формулы
// Opportunity. Он численно равен прежнему главному баллу — прежний взгляд
// не потерян, он просто перестал быть единственным.
//
// Фича 004 добавила порядок, фильтры и страницы (FR-034): прогон перестал
// приносить шесть трендов и приносит сотни. Фича 011 добавила регион — он
// стоит отдельно от фильтров, потому что пересчитывает баллы, а не прячет
// строки.

import { addManualTrend, getCandidates, getTrends, isReadOnly } from "../api.js";
import { html, raw, phaseLabel, contentTypeLabel, plural, score } from "../format.js";
import { checkLinks } from "../components/checklinks.js";
import { sticker } from "../components/sticker.js";
import { scorebar } from "../components/scorecard.js";
import { stagger } from "../motion.js";
import { skeleton, skelCards } from "../components/skeleton.js";
import {
  applyFilters,
  applySort,
  bindListControls,
  byDateDesc,
  byNumberAsc,
  byNumberDesc,
  emptyList,
  guessNote,
  listControls,
  makeState,
  paginate,
  pager,
} from "../components/listcontrols.js";
import {
  WORLD,
  bindRegionSwitch,
  footprintLabel,
  regionSwitch,
  rowsForRegion,
} from "../components/regionswitch.js";
import { sourceFilter } from "../components/sourcefilter.js";
import { bindSearchBox, searchBox } from "../components/searchbox.js";
import { searchRows } from "../search/match.js";
import { navigate, queryParam, setQueryParam } from "../router.js";

let sort = "opportunity";

// Играбельность вышла из формулы Opportunity (фича 011)
// и стала отдельной оценкой: она собрана из ответов модели о признаках
// явления, а конкуренция и спрос замерены в магазине и у Google — мягкая
// величина не должна править порядком твёрдых.
//
// «Из этого выйдет игра» численно равен прежнему Opportunity, поэтому старый
// взгляд не потерян: он стал отдельной кнопкой.
const LISTS = {
  opportunity: {
    switchLabel: "Возможности",
    title: "Возможности",
    metric: { key: "opportunity", label: "Opportunity" },
    hint: "Порядок — по Opportunity: спрос × свобода ниши × момент. Про рынок, не про игру.",
    empty: "Ни один тренд ещё не проверен в магазине.",
  },
  // Тот же балл без множителя момента (2026-08-14). Считает сервер той же
  // формулой с теми же спрос-воротами — клиент только сортирует по полю.
  opportunity_no_timing: {
    switchLabel: "Спрос × ниша",
    title: "Спрос × ниша",
    metric: { key: "opportunity_no_timing", label: "Спрос × ниша" },
    hint: "Порядок — спрос × свобода ниши, без момента: что стоит ниша, если не гнаться за волной.",
    empty: "Ни один тренд ещё не проверен в магазине.",
  },
  game_fit: {
    switchLabel: "Из этого выйдет игра",
    title: "Из этого выйдет игра",
    metric: { key: "game_fit", label: "Игра" },
    hint: "Порядок — возможность × игровой потенциал. Тренды без оценки признаков сюда не попадают.",
    empty: "Признаки игропригодности ещё никому не проставлены.",
  },
  trend: {
    switchLabel: "Громкие сейчас",
    title: "Громкие сейчас",
    metric: { key: "trend", label: "Сигнал" },
    hint: "Порядок — по чистому сигналу источников. Сигнал угасает по пропущенным прогонам.",
    empty: "Сигналов пока нет.",
  },
};

// Порядок пунктов: сперва четыре балла из переключателя списков, потом
// отдельные показатели полосы. «По спросу» — сам замер (0.7·Play + 0.3·Trends),
// без свободы ниши и момента: вопрос «что вообще ищут» задаётся отдельно от
// «где свободно», иначе пустая ниша с нулевым спросом стоит выше живого имени.
//
// Половины спроса стоят отдельными пунктами по той же причине, по которой они
// разложены в полосе показателей (2026-08-05): общий балл не отвечает, ищут имя
// в магазине или только в вебе. «Throw a Coin» имел десять веб-подсказок и ноль
// в Play, а по общему баллу был неотличим от имени, которое ищут игроки.
export const SORTS = [
  { value: "opportunity", label: "по возможности" },
  { value: "opportunity_no_timing", label: "по спросу × нише" },
  { value: "game_fit", label: "по игре" },
  { value: "trend", label: "по сигналу" },
  { value: "search", label: "по спросу" },
  { value: "play", label: "по спросу в Play" },
  { value: "interest", label: "по интересу Google Trends" },
  { value: "gameability", label: "по игровому потенциалу" },
  { value: "growth", label: "по росту" },
  { value: "competition", label: "по конкуренции" },
  { value: "last_seen", label: "по дате встречи" },
  { value: "first_seen", label: "по дате появления" },
];

export const COMPARATORS = {
  opportunity: byNumberDesc("opportunity"),
  opportunity_no_timing: byNumberDesc("opportunity_no_timing"),
  game_fit: byNumberDesc("game_fit"),
  trend: byNumberDesc("trend"),
  // Непроверенные уезжают вниз сами: у них `search` пустой, а не ноль —
  // «спрос не мерили» не должно выглядеть как «спроса нет» (FR-016). То же
  // и у половин: пустой `interest` — это «Google Trends не ответил» (у таких
  // строк горит метка «спрос без Google Trends»), а не «имя не ищут».
  search: byNumberDesc("search"),
  play: byNumberDesc("play"),
  interest: byNumberDesc("interest"),
  gameability: byNumberDesc("gameability"),
  growth: byNumberDesc("growth"),
  // Меньше — лучше, поэтому по возрастанию; непроверенные всё равно уезжают вниз
  competition: byNumberAsc("competition"),
  last_seen: byDateDesc("last_seen"),
  first_seen: byDateDesc("first_seen"),
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
    match: (row, value) => (row.content_type || "other") === value,
  },
  {
    key: "check",
    label: "Проверка",
    options: [
      { value: "all", label: "любая" },
      { value: "verified", label: "проверенные" },
      { value: "unverified", label: "непроверенные" },
      { value: "free", label: "ниша свободна" },
    ],
    match: (row, value) => {
      if (value === "verified") return row.verified === true;
      if (value === "unverified") return row.verified !== true;
      return Boolean(row.niche_free);
    },
  },
  {
    // Фича 003: имя принадлежит человеку или правообладателю. Это факт рядом
    // с баллом, а не множитель — в Opportunity он не входит, и решение о том,
    // связываться ли с чужим именем, остаётся за человеком.
    key: "name",
    label: "Имя",
    options: [
      { value: "all", label: "любое" },
      { value: "own", label: "свободное" },
      { value: "foreign", label: "чужое" },
    ],
    match: (row, value) =>
      value === "foreign" ? Boolean(row.foreign_ip) : !row.foreign_ip,
  },
];

const state = makeState("opportunity");
let rows = [];
// Пороги делений приезжают с данными, а не зашиты здесь (конституция III).
let bands = null;

// Кандидаты нужны только для одной строки в подсказках — «в кандидатах ещё N».
// Грузятся один раз, фоном, уже после своего списка: без них раздел работает.
let candidateRows = null;
let candidatesFailed = false;

export async function trendsView(mount) {
  const list = LISTS[sort];
  state.sort = sort;
  // Восстанавливаем регион из адреса до первой отрисовки: иначе открытая
  // ссылка показала бы всемирные баллы под подписью выбранной страны.
  state.region = queryParam("region") || WORLD;
  // Запрос читается из адреса всегда, даже пустой: иначе он пережил бы уход
  // в другой раздел и возвращение по чистой ссылке.
  state.query = queryParam("q");
  mount.insertAdjacentHTML(
    "beforeend",
    html`
      <header class="view-head">
        <div>
          <p class="eyebrow">Находки</p>
          <h1 class="view-title">${list.title}</h1>
        </div>
        <div class="switch" role="group" aria-label="Порядок списка">
          ${raw(
            Object.entries(LISTS)
              .map(
                ([key, value]) => html`
                  <button type="button" data-sort="${key}" aria-pressed="${key === sort}">
                    ${value.switchLabel}
                  </button>
                `,
              )
              .join(""),
          )}
        </div>
      </header>
      <p class="runline" id="list-hint">${list.hint}</p>
      ${raw(regionSwitch(state.region))}
      ${raw(
        isReadOnly()
          ? ""
          : html`<form class="addtrend" id="add-trend">
              <label class="addtrend__field">
                <span class="controls__label">Внести тренд руками</span>
                <input
                  type="text"
                  name="title"
                  placeholder="Имя явления"
                  autocomplete="off"
                />
              </label>
              <label class="addtrend__field">
                <span class="controls__label">Зачем</span>
                <input
                  type="text"
                  name="note"
                  placeholder="необязательно"
                  autocomplete="off"
                />
              </label>
              <button type="submit">Внести</button>
              <p class="addtrend__status" role="status"></p>
            </form>`,
      )}
      ${raw(
        searchBox({
          id: "trends",
          placeholder: "имя тренда, «/» — фокус",
          value: state.query,
        }),
      )}
      <div class="section" id="finds" aria-busy="true">
        <p class="sr-only" role="status">Загружаю…</p>
        ${raw(skeleton(skelCards(8)))}
      </div>
    `,
  );

  mount.querySelectorAll("[data-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.sort === sort) return;
      sort = button.dataset.sort;
      state.page = 1;
      mount.replaceChildren();
      trendsView(mount);
    });
  });

  // Регион живёт в адресе: ссылкой на «RU» можно поделиться и вернуться
  // к ней — и увидеть те же баллы, а не всемирные (FR-027).
  bindRegionSwitch(mount, (region) => {
    if (region === state.region) return;
    state.region = region;
    state.page = 1;
    setQueryParam("region", region, WORLD);
    mount.replaceChildren();
    trendsView(mount);
  });

  if (!isReadOnly()) bindAddTrend(mount);

  const target = mount.querySelector("#finds");
  try {
    // include=all, а не active: неактивные строки нужны поиску. Без них
    // «Tung Tung Sahur», пропавший из прогонов, не находился вообще, хотя
    // ручное добавление честно отвечало «уже есть в базе».
    const payload = await getTrends({ sort, include: "all" });
    rows = payload.trends;
    bands = payload.bands || null;
  } catch (error) {
    target.removeAttribute("aria-busy");
    target.innerHTML = html`<div class="alert">${error.message}</div>`;
    return;
  }
  target.removeAttribute("aria-busy");
  bindSearch(mount, target, list);
  render(target, list);
  loadCandidates();
}

/**
 * Поиск привязывается после загрузки: до неё искать не в чем, а перерисовка
 * пустого списка стёрла бы скелет ожидания.
 */
function bindSearch(mount, target, list) {
  bindSearchBox(mount, {
    id: "trends",
    rows: () => rows,
    field: "title",
    meta: (row) => `${contentTypeLabel(row.content_type)} · ${score(row.opportunity)}`,
    neighbour: neighbourLine,
    onQuery: (query) => {
      state.query = query;
      state.page = 1;
      setQueryParam("q", query, "");
      render(target, list);
    },
    // У тренда есть своя страница — выбор ведёт прямо на неё.
    onPick: (row) => navigate(`/trend/${encodeURIComponent(row.slug)}`),
  });
}

async function loadCandidates() {
  if (candidateRows || candidatesFailed) return;
  try {
    candidateRows = await getCandidates();
  } catch {
    candidatesFailed = true;
  }
}

/**
 * Строка про соседний раздел.
 *
 * Молчать, когда список кандидатов не доехал, нельзя: пустота в этом месте
 * читается как «там ничего нет», а это уже неправда (конституция II).
 */
function neighbourLine(query, own) {
  if (candidatesFailed) return { text: "в кандидатах — не проверил, сервер молчит" };
  if (!candidateRows) return null;
  const count = searchRows(candidateRows, query, { field: "name" }).length;
  if (!count) return null;
  return {
    text: `в кандидатах ${own ? "ещё " : ""}${count}`,
    href: `#/candidates?q=${encodeURIComponent(query)}`,
  };
}

/**
 * Форма ручного ввода (фича 005, US4).
 *
 * Три исхода различаются полями ответа, а не текстом, и каждый обязан быть
 * назван вслух: молча показать «готово» на найденном дубликате значит соврать —
 * человек решит, что завёл новое имя.
 */
function bindAddTrend(mount) {
  const form = mount.querySelector("#add-trend");
  const status = form.querySelector(".addtrend__status");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = form.elements.title.value.trim();
    if (!title) {
      status.textContent = "Имя не может быть пустым.";
      return;
    }
    const button = form.querySelector("button");
    button.disabled = true;
    status.textContent = "Вношу…";
    try {
      const result = await addManualTrend(title, form.elements.note.value.trim());
      if (result.created) {
        status.textContent = `Заведён тренд «${title}». Проверю в магазине ближайшим прогоном.`;
        form.reset();
      } else if (result.promoted_from_candidate) {
        status.textContent = `Такое имя уже было кандидатом — повысил до тренда.`;
        form.reset();
      } else {
        // Обязательно называем, ПОД КАКИМ именем тренд живёт в базе: без этого
        // человек ищет введённое написание, не находит и решает, что запись
        // пропала, — живой случай с «Tung Tung Sahur» под слогом tung-sahur.
        status.innerHTML = html`Уже есть в базе как
          <a href="#/trend/${encodeURIComponent(result.slug)}">«${result.title || title}»</a>.`;
      }
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

function render(target, list) {
  // Порядок шагов важен. Регион идёт ПЕРВЫМ: он меняет сами баллы, и фильтр
  // «ниша свободна» вместе с сортировкой обязаны работать уже по ним.
  const inRegion = rowsForRegion(rows, state.region);
  // Скрытые из списков тренды убраны не молча: их число названо строкой ниже
  // (конституция II), а с запросом они находятся — см. visiblePool.
  const shown = visiblePool(inRegion, state.query);
  const hiddenQuiet = inRegion.length - shown.length;
  // Список «Из этого выйдет игра» не показывает тренды без оценки признаков:
  // у них game_fit не ноль, а неизвестность, и место в порядке им дать не из чего.
  const pool = sort === "game_fit" ? shown.filter((row) => row.game_fit !== null) : shown;
  // Поиск идёт следующим шагом, но порядок выдачи не трогает: список,
  // озаглавленный «по возможности», обязан быть отсортирован по возможности.
  // Релевантность правит только выпадашкой подсказок.
  const found = searchRows(pool, state.query, { field: "title" });
  // Источник — фильтр из данных, как регион у кандидатов: варианты собираются
  // из строк (просьба пользователя 2026-08-09 — «показать всё из чата Twitch»).
  const filters = [...FILTERS, sourceFilter(rows)];
  const filtered = applyFilters(
    found.map((match) => match.row),
    state,
    filters,
  );
  const sorted = applySort(filtered, COMPARATORS[state.sort] || COMPARATORS.opportunity);
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
        ${raw(hiddenNote(hiddenQuiet))}
        ${raw(guessNote(found, state.query))}
        ${raw(
          page.rows.length
            ? html`<ul class="finds rise-list">
                ${raw(page.rows.map((row) => findCard(row, bands, list.metric)).join(""))}
              </ul>`
            : emptyList(state, "тренды"),
        )}
        ${raw(pager(page))}
      `
    : html`<div class="empty">
        <b>Пусто</b>
        <p>${list.empty} Запусти прогон: <code>python -m trendhunter.pipeline</code></p>
      </div>`;

  bindListControls(target, state, () => render(target, list));
  stagger(target.querySelector(".rise-list"));
}

/**
 * Что попадает в список.
 *
 * Неактивные тренды НЕ прячутся (решение пользователя 2026-08-08): они стоят
 * в списках с пометкой «не встречен N прогонов», а угасший сигнал сам уводит
 * их вниз. Без запроса скрывается только confirm_only — одни новости дня без
 * живого подтверждения. С запросом ищется ВСЯ база: подпись под списком
 * обещает «находятся поиском», и обещание обязано выполняться.
 */
export function visiblePool(rows, query) {
  if ((query || "").trim()) return rows;
  return rows.filter((row) => !row.confirm_only);
}

/**
 * Сколько трендов убрано из списков и почему.
 *
 * Молча вычесть записи нельзя: человек считает, что база меньше, чем есть.
 */
function hiddenNote(hidden) {
  if (!hidden) return "";
  const word = plural(hidden, "тренд", "тренда", "трендов");
  return html`<p class="guess">
    ${hidden} ${word} скрыто: держатся на одних новостях дня и ещё не
    подтверждены живым источником. Находятся поиском и по прямой ссылке.
  </p>`;
}

export function findCard(row, bands = null, metric = null) {
  const verified = row.verified === true && row.opportunity !== null;
  const free = Boolean(row.niche_free);
  return html`
    <li class="find ${raw(verified && !free ? "find--taken" : "")}">
      <div>
        <a class="find__name" href="#/trend/${encodeURIComponent(row.slug)}">${row.title}</a>
        <div class="find__meta">
          <span class="tag">${contentTypeLabel(row.content_type)}</span>
          ${raw(row.foreign_ip ? '<span class="tag tag--warn">чужое имя</span>' : "")}
          <span class="tag">${phaseLabel(row.phase)}</span>
          ${raw(nicheTag(row, verified, free))}
          ${raw(row.search_partial ? '<span class="tag">спрос без Google Trends</span>' : "")}
          ${raw(regionTags(row))}
          ${raw(stalenessTag(row))}
          ${raw(row.growth_measurable === false ? '<span class="tag">рост не измерим</span>' : "")}
          ${raw(videosTag(row))}
          ${raw(mentionsTag(row))}
          ${raw(checkLinks(row.title, row.region, { compact: true }))}
        </div>
        ${raw(scorebar(row))}
        ${raw(freeElsewhere(row))}
      </div>
      ${raw(sticker(row, { bands, metric }))}
    </li>
  `;
}

/**
 * Пометки выбранного региона.
 *
 * «В RU не замечен» — не поражение тренда, а условие, при котором посчитан
 * его балл: ниша и спрос там настоящие, а сигнал взят всемирный со штрафом.
 * Молчать об этом нельзя — иначе число выглядит замером, которым не является.
 *
 * «Источники RU не видят» — другое и куда более слабое утверждение: спросить
 * было некого. Reddit и KYM ставят всем находкам GLOBAL и страну назвать не
 * могут, и их молчание читать как отсутствие тренда нельзя. Такой регион
 * штрафа не получает, но и замером не притворяется.
 *
 * Опорная страна означает РЫНОК (2026-08-08), поэтому «46 упоминаний из RU»
 * дополняется составом: «BY 22, KZ 9, UA 6». Число без состава выдавало бы
 * Беларусь за Россию.
 */
function regionTags(row) {
  if (!row.region || row.region === WORLD) return "";
  if (row.region_data === false) {
    return `<span class="tag tag--warn">по ${row.region} ещё не пересчитан</span>`;
  }
  const tags = [];
  if (row.local_measurable === false) {
    tags.push(`<span class="tag tag--warn">источники ${row.region} не видят</span>`);
  } else if (row.local_signal === false) {
    tags.push(`<span class="tag tag--warn">в ${row.region} не замечен</span>`);
  } else if (row.region_mentions) {
    const word = plural(row.region_mentions, "упоминание", "упоминания", "упоминаний");
    const from = footprintLabel(row.region_footprint, row.region);
    tags.push(
      `<span class="tag">${row.region_mentions} ${word} из ${row.region}` +
        (from ? ` — ${from}` : "") +
        `</span>`,
    );
  }
  if (row.competition_scope === "worldwide") {
    tags.push('<span class="tag tag--warn">конкуренция ещё всемирная</span>');
  }
  return tags.join("");
}

/** Сигнал угасает по пропущенным прогонам — это надо назвать словами. */
function stalenessTag(row) {
  if (!row.runs_missing) return "";
  const word = plural(row.runs_missing, "прогон", "прогона", "прогонов");
  return `<span class="tag tag--warn">не встречен ${row.runs_missing} ${word}</span>`;
}

/**
 * Где ещё ниша свободна.
 *
 * Прямой ответ на вопрос «куда идти»: всемирный балл строгий и показывает
 * занятость по объединению пяти сторов, а войти можно в ту страну, где пусто.
 */
function freeElsewhere(row) {
  // Только когда в текущем разрезе ниша занята. Если она свободна и здесь,
  // строка не сообщает ничего: «куда идти» спрашивают, упёршись в занятое.
  if (row.niche_free) return "";
  const free = Object.entries(row.by_region || {})
    .filter(([code, slice]) => slice.niche_free && code !== row.region)
    .map(([code]) => code);
  if (!free.length) return "";
  return html`<p class="find__free">Ниша свободна в ${free.join(", ")}</p>`;
}

function nicheTag(row, verified, free) {
  if (!verified) return '<span class="tag">ниша не проверена</span>';
  // Поиск не видит конкурентов из локали замера, а подсказки говорят
  // обратное (2026-08-16): «игр в поиске: 0» здесь была бы ложью. Когда
  // конкуренты добраны через APKPure, показывается их счёт с источником.
  if (row.competitors_hidden) {
    return row.competitors_count
      ? `<span class="tag tag--taken">конкурентов: ${row.competitors_count} (APKPure)</span>`
      : '<span class="tag tag--warn">конкуренты не видны</span>';
  }
  return free
    ? '<span class="tag tag--free">ниша свободна</span>'
    : `<span class="tag tag--taken">игр в поиске: ${row.competitors_count}</span>`;
}

function videosTag(row) {
  if (!row.videos_count) return "";
  const word = plural(row.videos_count, "видео", "видео", "видео");
  return `<span class="tag">${row.videos_count} ${word}</span>`;
}

function mentionsTag(row) {
  if (!row.mentions_count) return "";
  // Когда выбран регион, его счёт уже показан отдельной меткой. Второе такое
  // же число рядом читается как ошибка, а не как всемирный итог.
  if (row.region && row.region !== WORLD && row.region_data !== false) {
    if (row.region_mentions === row.mentions_count) return "";
    const rest = row.mentions_count - (row.region_mentions || 0);
    const where = plural(rest, "в другой стране", "в других странах", "в других странах");
    return `<span class="tag">ещё ${rest} ${where}</span>`;
  }
  const word = plural(row.mentions_count, "упоминание", "упоминания", "упоминаний");
  return `<span class="tag">${row.mentions_count} ${word}</span>`;
}
