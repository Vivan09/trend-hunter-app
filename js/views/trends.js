// Раздел «Тренды»: четыре списка одних и тех же находок (FR-022, FR-023).
//
// Списки не для симметрии — это разные вопросы. «Возможности» отвечают на
// «где спрос есть, а сильных соперников мало» (Opportunity v2), «Из этого
// выйдет игра» — на «из чего делать», «Громкие сейчас» — на «что сейчас
// гремит, даже если ниша занята». Список «Спрос × ниша» убран в фазе 0.5. Громкий
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
//
// P0 (2026-11-04) добавил пятый список — «Доказанный спрос» — и переключатель
// «Основной список | Чужие имена». Люди и чужие франшизы ушли из основного
// списка в отдельный, видимый, мусор — из обоих; поиск по-прежнему ищет всю
// базу. Переключатель заменил фильтр «Имя: свободное / чужое» фичи 003.

import { addManualTrend, getCandidates, getTrends, isReadOnly } from "../api.js";
import {
  NOT_MEASURED,
  STALE_MEASURE_DAYS,
  contentTypeLabel,
  growthLabel,
  html,
  measureAgeTag,
  phaseLabel,
  plural,
  raw,
  score,
  volumeLabel,
} from "../format.js";
import { checkLinks } from "../components/checklinks.js";
import { ruFreeHint } from "../components/competitors.js";
import { sticker } from "../components/sticker.js";
import {
  OLD_LABEL,
  OPPORTUNITY_V2,
  filterByPath,
  hasScore,
  isSaturated,
  opportunityTags,
  pathSwitch,
  regionNote,
  unmeasuredCount,
} from "../components/opportunity.js";
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
  byNewInGoogle,
  byOpportunityV2,
  byProvenDesc,
  emptyList,
  guessNote,
  isNewInGoogle,
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
import { JUNK, OK, RISK, eligibilityOf, eligibilityTag, poolCounts } from "../eligibility.js";

let sort = "opportunity";

// Играбельность вышла из формулы Opportunity (фича 011)
// и стала отдельной оценкой: она собрана из ответов модели о признаках
// явления, а конкуренция и спрос замерены в магазине и у Google — мягкая
// величина не должна править порядком твёрдых.
//
// «Из этого выйдет игра» численно равен прежнему Opportunity, поэтому старый
// взгляд не потерян: он стал отдельной кнопкой.
export const LISTS = {
  // Возможность (Opportunity v2, фаза 0.5, спека O4). Старый Opportunity живёт
  // только теневым порядком в журнале и на сервере (`sort=opportunity`).
  opportunity: {
    switchLabel: "Возможности",
    title: "Возможности",
    metric: OPPORTUNITY_V2,
    hint:
      "Где спрос есть, а сильных соперников мало. Учитывает установки игр с этим именем, " +
      "поиск в Play, силу сигнала сейчас и размер лидера. Громкая игра без сильных клонов " +
      "тоже попадает сюда, если Play уже подсказывает её имя.",
    empty: "Ни один тренд ещё не проверен в магазине.",
  },
  // Доказанный спрос (P0-B, 2026-11-04) стоит рядом с Opportunity, а не
  // вместо него: он любит имена, у которых уже есть клоны с установками, —
  // это бывает и поздней стадией волны. Кто из двух угадывает, решит журнал
  // прогнозов, поэтому в подписи — «на проверке». Строки без балла сюда
  // не попадают: неизвестность не ноль, и места в порядке ей дать не из чего.
  proven_demand: {
    switchLabel: "Доказанный спрос",
    title: "Доказанный спрос",
    metric: { key: "proven_demand", label: "Доказ. спрос" },
    hint:
      "Порядок — по доказанному спросу: сколько чужих игр с этим именем уже набрали " +
      "установки и насколько. Новый балл, на проверке.",
    empty: "Доказанный спрос ещё никому не посчитан — нужен замер магазина.",
  },
  // Имена, которые Google начал искать недавно (Keyword Planner, 2026-11-05).
  // Свой список, а не примесь к Opportunity: это замер поиска, не рынка, и
  // данные Google отстают на 1–2 месяца — об этом сказано в подписи.
  new_in_google: {
    switchLabel: "Новое в Google",
    title: "Новое в Google",
    metric: { key: "kp_volume", label: "Google" },
    hint:
      "Имена, которые начали искать в Google за последние 3 месяца, по скорости роста. " +
      "Данные Google отстают на 1–2 месяца.",
    empty: "Новых в Google имён пока нет — нужен замер Keyword Planner.",
  },
  // Список «Спрос × ниша» (`opportunity_no_timing`) убран в фазе 0.5: он целиком
  // на старой формуле. Поле индекса остаётся, вкладки и сортировки у него нет.
  game_fit: {
    switchLabel: "Из этого выйдет игра",
    title: "Из этого выйдет игра",
    metric: { key: "game_fit", label: "Игра" },
    // game_fit посчитан из прежнего Opportunity, а не из вкладки «Возможности».
    hint:
      `Порядок — ${OLD_LABEL} × игровой потенциал: это не балл вкладки «Возможности». ` +
      "Тренды без оценки признаков сюда не попадают.",
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
  { value: "proven_demand", label: "по доказанному спросу" },
  { value: "new_in_google", label: "по росту в Google" },
  { value: "game_fit", label: "по игре" },
  { value: "trend", label: "по сигналу" },
  { value: "search", label: "по спросу" },
  { value: "kp_volume", label: "по поиску Google" },
  { value: "play", label: "по спросу в Play" },
  { value: "interest", label: "по интересу Google Trends" },
  { value: "gameability", label: "по игровому потенциалу" },
  { value: "growth", label: "по росту" },
  { value: "competition", label: "по конкуренции" },
  { value: "last_seen", label: "по дате встречи" },
  { value: "first_seen", label: "по дате появления" },
];

export const COMPARATORS = {
  opportunity: byOpportunityV2,
  proven_demand: byProvenDesc,
  new_in_google: byNewInGoogle,
  kp_volume: byNumberDesc("kp_volume"),
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
  // Фильтр «Имя: свободное / чужое» (фича 003) снят 2026-11-04: его заменил
  // переключатель «Основной список | Чужие имена». Чужое имя по-прежнему не
  // множитель в Opportunity — оно просто живёт в своём списке.
];

// Два списка одной базы (P0-A). Мусора среди них нет намеренно: смотреть
// на «kkkkk» незачем, а найти его можно поиском — с запросом показывается всё.
const POOLS = [
  { value: OK, label: "Основной список" },
  { value: RISK, label: "Чужие имена" },
];

const PATH_VALUES = ["all", "proven", "wave"];

/** Что писать в `?path=`: путь живёт только на вкладке «Возможности». */
export function pathParamFor(sortKey, path) {
  return sortKey === "opportunity" && path !== "all" ? path : "";
}

/**
 * Фильтры вкладки. «Ниша свободна» меряет старую `niche_free`, а вкладка
 * «Возможности» говорит словами новой формулы, поэтому там пункта нет.
 */
export function filtersFor(sortKey, rows) {
  const base = sortKey === "opportunity"
    ? FILTERS.map((filter) =>
        filter.key === "check"
          ? { ...filter, options: filter.options.filter((option) => option.value !== "free") }
          : filter,
      )
    : FILTERS;
  return [...base, sourceFilter(rows)];
}

/**
 * Сколько активных строк стоит в очереди замера: считается по списку ДО поиска.
 * С запросом `visiblePool` отдаёт всю базу, и счёт прыгал бы вместе с мусором,
 * который в очередь не попадает.
 */
export function unmeasuredQueue(inRegion, pool = OK) {
  return unmeasuredCount(visiblePool(inRegion, "", pool));
}

const RISK_HINT =
  "Люди и правообладатели: игра под таким именем рискует отказом Google Play " +
  "за имперсонацию или чужую IP — список для наблюдения, не для выбора.";

const state = makeState("opportunity");

// Серверная сортировка списка. «opportunity» у сервера — старый балл (теневой
// порядок), поэтому вкладка просит `opportunity_v2` явно.
const serverSort = (key) => (key === "opportunity" ? "opportunity_v2" : key);
let rows = [];
// Пороги делений приезжают с данными, а не зашиты здесь (конституция III).
let bands = null;
let warnDays = STALE_MEASURE_DAYS;

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
  // Список — тоже из адреса, как регион: ссылка на «Чужие имена» обязана
  // открывать именно их. Неизвестное значение — основной список.
  state.pool = POOLS.some((pool) => pool.value === queryParam("pool"))
    ? queryParam("pool")
    : OK;
  // Путь — такой же параметр адреса, как список и регион: ссылка на «Волну»
  // открывает именно её. Неизвестное значение — «Все».
  state.path = PATH_VALUES.includes(queryParam("path")) ? queryParam("path") : "all";
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
      // ?path= бессмысленен вне «Возможностей» и не должен ехать в адресе дальше.
      if (sort !== "opportunity") setQueryParam("path", pathParamFor(sort, state.path), "");
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
    const payload = await getTrends({ sort: serverSort(sort), include: "all" });
    rows = payload.trends;
    bands = payload.bands || null;
    warnDays = payload.run?.measure_warn_days ?? STALE_MEASURE_DAYS;
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
    meta: (row) =>
      `${contentTypeLabel(row.content_type)} · ${score(sort === "opportunity" ? row.opportunity_v2 : row.opportunity)}`,
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
  const shown = visiblePool(inRegion, state.query, state.pool);
  const hidden = hiddenCounts(inRegion, shown, state.pool);
  // Списки «Из этого выйдет игра» и «Доказанный спрос» не показывают тренды
  // без своего балла: у них он не ноль, а неизвестность, и место в порядке
  // им дать не из чего.
  // Фильтр «Новое в Google» привязан к списку (`sort`), а не к выпадашке
  // (`state.sort`): та же сортировка в другом списке только переставляет
  // строки, как game_fit и proven_demand. Не «чинить».
  const pool =
    sort === "game_fit"
      ? shown.filter((row) => row.game_fit !== null)
      : sort === "proven_demand"
        ? shown.filter((row) => row.proven_demand !== null && row.proven_demand !== undefined)
        : sort === "new_in_google"
          ? shown.filter(isNewInGoogle)
          : shown;
  // Поиск идёт следующим шагом, но порядок выдачи не трогает: список,
  // озаглавленный «по возможности», обязан быть отсортирован по возможности.
  // Релевантность правит только выпадашкой подсказок.
  const onOpportunity = sort === "opportunity";
  // Путь «Спрос доказан / Волна» — только на этой вкладке и не при поиске.
  const byPath = onOpportunity ? filterByPath(pool, state.path, state.query) : pool;
  const found = searchRows(byPath, state.query, { field: "title" });
  // Источник — фильтр из данных, как регион у кандидатов: варианты собираются
  // из строк (просьба пользователя 2026-08-09 — «показать всё из чата Twitch»).
  const filters = filtersFor(sort, rows);
  // Выбранный раньше «ниша свободна» не должен молча резать список, где его нет.
  if (onOpportunity && state.filters.check === "free") state.filters.check = "all";
  const filtered = applyFilters(
    found.map((match) => match.row),
    state,
    filters,
  );
  const sorted = applySort(filtered, COMPARATORS[state.sort] || COMPARATORS.opportunity);
  const page = paginate(sorted, state);

  target.innerHTML = rows.length
    ? html`
        ${raw(poolSwitch(inRegion, state.pool))}
        ${raw(onOpportunity ? pathSwitch(state.path, Boolean((state.query || "").trim()), unmeasuredQueue(inRegion, state.pool)) : "")}
        ${raw(onOpportunity && regionNote(state.region) ? html`<p class="runline">${regionNote(state.region)}</p>` : "")}
        ${raw(state.pool === RISK ? html`<p class="runline">${RISK_HINT}</p>` : "")}
        ${raw(
          listControls(state, {
            sorts: SORTS,
            filters,
            total: filtered.length,
            shown: page.rows.length,
          }),
        )}
        ${raw(hiddenNote(hidden))}
        ${raw(guessNote(found, state.query))}
        ${raw(
          page.rows.length
            ? html`<ul class="finds rise-list">
                ${raw(page.rows.map((row) => findCard(row, bands, list.metric, { sortKey: state.sort, warnDays })).join(""))}
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
  bindPoolSwitch(target, () => render(target, list));
  bindPathSwitch(target, () => render(target, list));
  stagger(target.querySelector(".rise-list"));
}

/**
 * «Основной список (N) | Чужие имена (N)».
 *
 * Числа — АКТИВНЫЕ тренды, как в строке дайджеста «Вне списков: N»: человек
 * сверяет их между собой. Неактивные при этом в списке стоят (решение
 * 2026-08-08), поэтому общий счёт под переключателем больше — подпись
 * «активных» это называет, а не прячет. «Одни новости дня» не считаются:
 * в списках их нет ни в одном.
 */
export function poolSwitch(rows, active = OK) {
  const counts = poolCounts((rows || []).filter((row) => !row.confirm_only));
  return html`
    <div class="regions" role="group" aria-label="Список">
      <span class="regions__label">Список</span>
      ${raw(
        POOLS.map(
          (pool) => html`
            <button
              type="button"
              class="regions__pill"
              data-pool="${pool.value}"
              aria-pressed="${pool.value === active}"
              title="активных трендов; неактивные тоже в списке, с пометкой «не встречен»"
            >
              ${pool.label}
              (${counts[pool.value]}
              ${plural(counts[pool.value], "активный", "активных", "активных")})
            </button>
          `,
        ).join(""),
      )}
    </div>
  `;
}

function bindPathSwitch(root, onChange) {
  root.querySelectorAll("[data-path]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.path === state.path) return;
      state.path = button.dataset.path;
      state.page = 1;
      setQueryParam("path", state.path, "all");
      onChange();
    });
  });
}

function bindPoolSwitch(root, onChange) {
  root.querySelectorAll("[data-pool]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.pool === state.pool) return;
      state.pool = button.dataset.pool;
      state.page = 1;
      setQueryParam("pool", state.pool, OK);
      onChange();
    });
  });
}

/**
 * Что попадает в список.
 *
 * Неактивные тренды НЕ прячутся (решение пользователя 2026-08-08): они стоят
 * в списках с пометкой «не встречен N прочитанных прогонов», а угасший сигнал сам уводит
 * их вниз. Без запроса скрывается только confirm_only — одни новости дня без
 * живого подтверждения. С запросом ищется ВСЯ база: подпись под списком
 * обещает «находятся поиском», и обещание обязано выполняться.
 *
 * С 2026-11-04 без запроса показывается ещё и только один класс допуска:
 * `ok` — основной список, `risk` — «Чужие имена». Мусор не виден ни в одном
 * и находится поиском. Строка без поля допуска — ok (старые trends.json).
 */
export function visiblePool(rows, query, pool = OK) {
  if ((query || "").trim()) return rows;
  return rows.filter((row) => !row.confirm_only && eligibilityOf(row) === pool);
}

/** Сколько строк базы не попало в показанный список — и по какой причине. */
function hiddenCounts(rows, shown, pool) {
  if (shown.length === rows.length) return { confirmOnly: 0, junk: 0, risk: 0 };
  const counts = { confirmOnly: 0, junk: 0, risk: 0 };
  for (const row of rows) {
    if (row.confirm_only) counts.confirmOnly += 1;
    else if (eligibilityOf(row) === JUNK) counts.junk += 1;
    else if (eligibilityOf(row) === RISK && pool !== RISK) counts.risk += 1;
  }
  return counts;
}

/**
 * Сколько трендов убрано из списков и почему — по причине отдельной фразой.
 *
 * Молча вычесть записи нельзя: человек считает, что база меньше, чем есть.
 * Числа — по всей базе, как и сам список (неактивные в нём стоят). И это
 * сказано словами: над строкой переключатель считает только активных, и
 * «Чужие имена (717 активных)» рядом с «2299 — люди и чужие франшизы» без
 * пояснения читались как три разных числа риска (финальное ревью P0,
 * 2026-11-04). Экспорт ради теста.
 */
export function hiddenNote({ confirmOnly = 0, junk = 0, risk = 0 } = {}) {
  const parts = [];
  if (confirmOnly) {
    const word = plural(confirmOnly, "тренд", "тренда", "трендов");
    parts.push(
      `${confirmOnly} ${word} скрыто: держатся на одних новостях дня и ещё не ` +
        "подтверждены живым источником.",
    );
  }
  if (risk) {
    parts.push(`${risk} — люди и чужие франшизы: они в списке «Чужие имена».`);
  }
  if (junk) {
    parts.push(`${junk} — мусор: смех из чата, служебные слова, ники и числа.`);
  }
  if (!parts.length) return "";
  return html`<p class="guess">${parts.join(" ")} Счёт — вместе с неактивными. Находятся поиском и по прямой ссылке.</p>`;
}

export function findCard(
  row,
  bands = null,
  metric = OPPORTUNITY_V2,
  { sortKey = "", now = Date.now(), warnDays = STALE_MEASURE_DAYS } = {},
) {
  // О нише на вкладке «Возможности» говорит формула v2: лидер, игры и насыщение
  // (спека O4). Старая конкуренция меряет похожие имена в выдаче, и её метка, клетка
  // и «свободна в …» спорили с этой же строкой. Число остаётся только тому, кто сам
  // выбрал порядок по конкуренции: иначе список стоял бы по невидимой величине.
  const onV2 = metric?.key === "opportunity_v2";
  const verified = row.verified === true && (!onV2 || hasScore(row));
  const taken = verified && (onV2 ? isSaturated(row) : !row.niche_free);
  // Читаемое имя: 900 трендов хранят slug вместо заголовка (замер
  // 2026-11-04). По нему же ищут проверочные ссылки — «aayu-and-pihu-show»
  // в поиске магазина хуже «Aayu and Pihu Show».
  const name = row.display_title || row.title;
  return html`
    <li class="find ${raw(taken ? "find--taken" : "")}">
      <div>
        <a class="find__name" href="#/trend/${encodeURIComponent(row.slug)}">${name}</a>
        <div class="find__meta">
          <span class="tag">${contentTypeLabel(row.content_type)}</span>
          ${raw(eligibilityTag(row))}
          <span class="tag">${phaseLabel(row.phase)}</span>
          ${raw(nicheTag(row, verified, onV2))}
          ${raw(onV2 ? opportunityTags(row) : "")}
          ${raw(googleTag(row))}
          ${raw(row.search_partial ? '<span class="tag">спрос без Google Trends</span>' : "")}
          ${raw(regionTags(row))}
          ${raw(stalenessTag(row))}
          ${raw(measureTag(row, now, warnDays))}
          ${raw(row.growth_measurable === false ? '<span class="tag">рост не измерим</span>' : "")}
          ${raw(videosTag(row))}
          ${raw(mentionsTag(row))}
          ${raw(checkLinks(name, row.region, { compact: true }))}
        </div>
        ${raw(scorebar(row, onV2 && sortKey !== "competition" ? { hide: ["competition"] } : {}))}
        ${raw(onV2 ? "" : freeElsewhere(row))}
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

/** Возраст замера магазина на любой вкладке списка (Р14): старый — тревожно, «не замерен» — просто. */
function measureTag(row, now, warnDays) {
  const text = measureAgeTag(row, now, warnDays);
  if (!text) return "";
  return html`<span class="tag ${raw(text === NOT_MEASURED ? "" : "tag--warn")}">${text}</span>`;
}

/**
 * Сигнал угасает по пропущенным прогонам — это надо назвать словами.
 *
 * Счётчик стоит в слепые прогоны (Р1), поэтому подпись говорит «прочитанных». У ручного
 * тренда он идёт и в слепые: там это слово было бы неправдой. Экспорт ради теста.
 */
export function stalenessTag(row) {
  const count = row.runs_missing;
  if (!count) return "";
  const word =
    row.source_of_record === "manual"
      ? plural(count, "прогон", "прогона", "прогонов")
      : plural(count, "прочитанный прогон", "прочитанных прогона", "прочитанных прогонов");
  return `<span class="tag tag--warn">не встречен ${count} ${word}</span>`;
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
  if (free.includes("RU")) {
    return html`<p class="find__free" title="${ruFreeHint()}">Ниша свободна в ${free.join(", ")}</p>`;
  }
  return html`<p class="find__free">Ниша свободна в ${free.join(", ")}</p>`;
}

function nicheTag(row, verified, onV2) {
  if (!verified) return '<span class="tag">ниша не проверена</span>';
  // Поиск не видит конкурентов из локали замера, а подсказки говорят
  // обратное (2026-08-16): «игр в поиске: 0» здесь была бы ложью. Когда
  // конкуренты добраны через APKPure, показывается их счёт с источником.
  if (row.competitors_hidden) {
    return row.competitors_count
      ? `<span class="tag ${onV2 ? "tag--warn" : "tag--taken"}">конкурентов: ${row.competitors_count} (APKPure)</span>`
      : '<span class="tag tag--warn">конкуренты не видны</span>';
  }
  // На балле v2 нишу описывают путь и факты лидера (`opportunityTags`).
  if (onV2) return "";
  if (!row.niche_free) {
    return `<span class="tag tag--taken">игр в поиске: ${row.competitors_count}</span>`;
  }
  return row.region === "RU"
    ? html`<span class="tag tag--free" title="${ruFreeHint()}">ниша свободна</span>`
    : '<span class="tag tag--free">ниша свободна</span>';
}

/**
 * Поиск Google в строке: «🔎 1.2K/мес ↑41%» и пометка «новое в Google».
 * Нет замера (`kp_volume` пуст) — нет и метки: «не мерили» не пишем нулём;
 * замеренный ноль печатается, как хвост строки в дайджесте.
 *
 * Число близкой формы слова подписано « (как «zeus»)» — та же подпись, что
 * в дайджесте (финальное ревью, 2026-11-05): «zued» иначе показывал бы объём
 * «zeus» как свой. «Новое» — по тому же правилу, что список (`isNewInGoogle`).
 * Экспорт — ради теста метки.
 */
export function googleTag(row) {
  if (row.kp_volume === null || row.kp_volume === undefined) return "";
  const growth =
    row.kp_growth === null || row.kp_growth === undefined ? "" : ` ${growthLabel(row.kp_growth)}`;
  const variant = row.kp_variant_of ? ` (как «${row.kp_variant_of}»)` : "";
  const fresh = isNewInGoogle(row) ? ' <span class="tag tag--free">новое в Google</span>' : "";
  return html`<span class="tag">🔎 ${volumeLabel(row.kp_volume)}/мес${growth}${variant}</span>${raw(fresh)}`;
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
