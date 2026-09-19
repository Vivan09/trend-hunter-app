// Страница тренда: всё, что нужно для решения, на одном экране (FR-024).
//
// Порядок блоков — порядок вопросов, которые задаёт себе разработчик: что это,
// почему взлетело, растёт ли ещё, где смотрят, как выглядит, занято ли в
// магазине. Кнопка генерации стоит в шапке, потому что решение принимается
// по пяти показателям, а не после чтения всей страницы (SC-005).

import { generateIdeas, getTrend, getTrends } from "../api.js";
import { html, raw, contentTypeLabel, phaseLabel, daysSince, plural, score } from "../format.js";
import { checkLinks } from "../components/checklinks.js";
import { footprintLabel } from "../components/regionswitch.js";
import { sticker } from "../components/sticker.js";
import { scorebar, scoreNotes } from "../components/scorecard.js";
import { chart, bindChart } from "../components/chart.js";
import { videoList } from "../components/videocard.js";
import { mentionList } from "../components/mentioncard.js";
import { competitors } from "../components/competitors.js";
import { skeleton, skelCards, skelBlock } from "../components/skeleton.js";

export async function trendView(mount, { slug }) {
  mount.insertAdjacentHTML(
    "beforeend",
    html`
      <p class="sr-only" role="status">Загружаю тренд…</p>
      ${raw(skeleton(skelCards(1), skelBlock(220)))}
    `,
  );

  let trend;
  try {
    trend = await getTrend(slug);
  } catch (error) {
    mount.replaceChildren();
    mount.insertAdjacentHTML(
      "beforeend",
      html`
        <div class="empty">
          <b>${error.message}</b>
          <p>Вернуться к <a href="#/trends">списку трендов</a>.</p>
        </div>
      `,
    );
    return;
  }

  const row = lastRow(trend);
  const family = await loadFamily(trend);

  mount.replaceChildren();
  mount.insertAdjacentHTML("beforeend", header(trend, row, family) + body(trend, row));
  bindChart(mount, trend);
  bindGenerate(mount, trend);
}

/**
 * Кнопка генерации. Отказ показывается текстом рядом с кнопкой: тихо вернуть
 * пустой список — худшее, что можно сделать после явного действия (FR-033).
 */
function bindGenerate(mount, trend) {
  const buttons = [...mount.querySelectorAll("[data-generate]")];
  if (!buttons.length) return;

  buttons.forEach((button) =>
    button.addEventListener("click", async () => {
      const previous = button.textContent;
      buttons.forEach((other) => {
        other.disabled = true;
      });
      button.textContent = "Придумываю…";
      button.classList.add("cta--busy");
      mount.querySelector("#generate-error")?.remove();

      try {
        const result = await generateIdeas(trend.slug);
        const fresh = await getTrend(trend.slug);
        mount.replaceChildren();
        mount.insertAdjacentHTML(
          "beforeend",
          header(fresh, lastRow(fresh)) + body(fresh, lastRow(fresh)),
        );
        bindChart(mount, fresh);
        bindGenerate(mount, fresh);
        if (result.generated === 0) {
          notice(mount, "Модель не предложила ничего нового — попробуй ещё раз.");
        }
      } catch (error) {
        buttons.forEach((other) => {
          other.disabled = false;
        });
        button.textContent = previous;
        button.classList.remove("cta--busy");
        notice(mount, error.message);
      }
    }),
  );
}

function notice(mount, message) {
  mount
    .querySelector(".trendhead")
    ?.insertAdjacentHTML(
      "afterend",
      html`<div class="alert" id="generate-error">${message}</div>`,
    );
}

function lastRow(trend) {
  const latest = trend.history?.[trend.history.length - 1] || {};
  return {
    ...latest,
    niche_free: Boolean(trend.market?.niche_free),
    // Сырьё префиксного замера и флаг скрытых конкурентов живут в market:
    // карточка обязана показывать их, а не только итоговые баллы (2026-08-16).
    demand_prefix: trend.market?.demand_prefix,
    competitors_hidden: Boolean(trend.market?.competitors_hidden),
  };
}

/**
 * Список трендов — но только если у этого тренда есть семья.
 *
 * У подавляющего большинства трендов её нет, и грузить ради пустой строки
 * весь список на каждое открытие карточки было бы расточительством (SC-010:
 * страница не тянет лишнего). Отказ запроса — пустая семья, а не ошибка
 * страницы: строка родства не тот повод, чтобы не показать тренд.
 */
async function loadFamily(trend) {
  if (!trend.parent && trend.kind !== "umbrella") return [];
  try {
    return (await getTrends()).trends;
  } catch {
    return [];
  }
}

/**
 * Зонтичная семья (спека 2026-08-17).
 *
 * Показ и только показ: баллы у зонтика и у его детей считаются независимо
 * и никогда не складываются — ровно поэтому «Steal a Brainrot» и «Brainrot»
 * и разъехались на отдельные записи. Строка отвечает на вопрос «а это не то
 * же самое, что вон то?», не подменяя ни одного числа.
 *
 * `index` может быть пуст: список грузится отдельным запросом и мог не
 * ответить. Тогда строки просто нет — карточка выглядит как прежде.
 */
function familyLine(trend, index) {
  const rows = index || [];
  if (trend.parent) {
    const parent = rows.find((row) => row.slug === trend.parent);
    if (!parent) return "";
    return html`<p class="eyebrow">
      внутри зонтика <a href="#/trend/${parent.slug}">${parent.title}</a>
    </p>`;
  }
  if (trend.kind !== "umbrella") return "";
  const children = rows.filter((row) => row.parent === trend.slug);
  if (!children.length) return "";
  const links = children
    .map((row) => html`<a href="#/trend/${row.slug}">${row.title}</a>`)
    .join(", ");
  return html`<p class="eyebrow">зонтик над: ${raw(links)}</p>`;
}

function header(trend, row, index) {
  const age = daysSince(trend.first_seen);
  return html`
    <header class="trendhead">
      <div class="trendhead__main">
        <p class="eyebrow">
          <a href="#/trends">← все тренды</a>
        </p>
        <h1 class="trendhead__name">${trend.title}</h1>
        ${raw(familyLine(trend, index))}
        <div class="find__meta">
          <span class="tag">${contentTypeLabel(trend.content_type)}</span>
          <span class="tag">${phaseLabel(row.phase)}</span>
          ${raw(
            age === null
              ? ""
              : html`<span class="tag"
                  >${age} ${plural(age, "день", "дня", "дней")} в базе</span
                >`,
          )}
          ${raw(
            trend.active
              ? ""
              : '<span class="tag tag--warn">не встречался в последних прогонах</span>',
          )}
        </div>
        ${raw(scorebar(row, { className: "scorebar scorebar--lg" }))}
        <div class="find__meta">${raw(checkLinks(trend.title))}</div>
      </div>
      <div class="trendhead__side">
        ${raw(sticker(row, { large: true }))}
        <button class="cta" type="button" data-generate="${trend.slug}">
          ✨ Сгенерировать идеи
        </button>
      </div>
    </header>
    ${raw(scoreNotes(row))}
  `;
}

function body(trend, row) {
  return html`
    ${raw(section("Что это", about(trend)))}
    ${raw(
      section(
        `Исходные материалы (${trend.mentions?.length || 0})`,
        mentionList(trend.mentions),
      ),
    )}
    ${raw(section("Динамика", chart(trend) + formulaBreak(trend)))}
    ${raw(section("По регионам", byRegion(trend, row)))}
    ${raw(section("Где ищут", geo(trend)))}
    ${raw(section("Где замечен", regionsSeen(trend)))}
    ${raw(section(`Видео (${trend.videos?.length || 0})`, videoList(trend.videos)))}
    ${raw(section("Google Play", competitors(trend.market)))}
    ${raw(section("Идеи", ideas(trend)))}
  `;
}

function section(title, content) {
  return html`
    <section class="section">
      <div class="section__head"><h2 class="eyebrow">${title}</h2></div>
      ${raw(content)}
    </section>
  `;
}

/**
 * Разрыв в методике на графике (фича 011).
 *
 * До 2026-08-04 Opportunity включал играбельность множителем. Записи до и
 * после — разные величины, и без этой строки скачок на графике читался бы
 * как поведение тренда. Строка гаснет сама, когда старые записи уйдут за
 * `history_days` — прежние данные при этом не переписываются (FR-008).
 */
function formulaBreak(trend) {
  const history = trend.history || [];
  const old = history.filter((entry) => !entry.formula).length;
  if (!old || old === history.length) return "";
  return html`<p class="note">
    Первые ${old} ${plural(old, "запись", "записи", "записей")} на графике
    посчитаны прежней формулой, где Opportunity включал игровой потенциал
    множителем. Сравнивать их с новыми напрямую нельзя.
  </p>`;
}

/**
 * Показатели по пяти опорным странам (фича 011).
 *
 * Вопрос «свободна ли ниша» не имеет всемирного ответа: у одного и того же
 * имени она бывает занята в US и пуста в RU. Всемирный балл строгий — он
 * считает занятость по объединению пяти сторов, — а таблица показывает, куда
 * из этого можно войти.
 *
 * Первой строкой закреплён «Весь мир»: региональный балл без всемирного
 * ориентира не читается как сравнение. В сортировке стран он не участвует —
 * это точка отсчёта, а не шестой регион.
 */
function byRegion(trend, worldRow) {
  const rows = Object.entries(trend.regions_scores || {});
  if (!rows.length) {
    return html`<p class="note">
      Тренд ещё не пересчитывался по регионам. Срез появится после ближайшей
      проверки в магазине — за прогон проверяется ограниченное число трендов.
    </p>`;
  }
  return html`
    <div class="table-wrap">
      <table class="regiontable">
        <thead>
          <tr>
            <th>Регион</th><th>Opportunity</th><th>Сигнал</th>
            <th>Спрос</th><th>Конкуренция</th><th>Упоминаний</th>
            <th>Проверить</th>
          </tr>
        </thead>
        <tbody>
          ${raw(worldTableRow(trend, worldRow))}
          ${raw(
            rows
              .sort((a, b) => (b[1].opportunity || 0) - (a[1].opportunity || 0))
              .map(([code, slice]) => regionRow(code, slice, trend.title))
              .join(""),
          )}
        </tbody>
      </table>
    </div>
  `;
}

/** Всемирные значения — из последней записи истории, ниша — из магазина. */
function worldTableRow(trend, row) {
  // Скрытые конкуренты главнее «свободна»: поиск их не видит из локали
  // замера, но подсказки говорят обратное (2026-08-16).
  const free = row.competitors_hidden
    ? ' <span class="tag tag--warn">конкуренты не видны</span>'
    : row.niche_free
      ? ' <span class="tag tag--free">свободна</span>'
      : "";
  return html`
    <tr class="regiontable__world">
      <td class="regiontable__code">Весь мир</td>
      <td><b>${score(row.opportunity)}</b></td>
      <td>${score(row.trend)}</td>
      <td>${score(row.search)}</td>
      <td>${score(row.competition)}${raw(free)}</td>
      <td>${trend.mentions?.length || 0}</td>
      <td>${raw(checkLinks(trend.title, "", { compact: true }))}</td>
    </tr>
  `;
}

export function regionRow(code, slice, title) {
  const free = slice.competitors_hidden
    ? ' <span class="tag tag--warn">конкуренты не видны</span>'
    : slice.niche_free
      ? ' <span class="tag tag--free">свободна</span>'
      : "";
  // Числа без причин выглядят произволом: демпфер и языковой прокси
  // (фича 013b) называются словами прямо в строке.
  const capped = slice.demand_capped
    ? ' <span class="tag">упёрся в спрос</span>'
    : "";
  const script = slice.foreign_script
    ? ' <span class="tag tag--warn">материалы другим алфавитом</span>'
    : "";
  // «Не замечен» — не поражение тренда, а условие, при котором посчитан балл:
  // сигнал взят всемирный со штрафом, ниша и спрос настоящие. «Не видят» —
  // слабее: источники этого тренда страну назвать не могут (Reddit и KYM
  // ставят всем находкам GLOBAL), поэтому штрафа нет, но и замера нет.
  const local =
    slice.local_measurable === false
      ? ' <span class="tag tag--warn">не видят</span>'
      : slice.local_signal === false
        ? ' <span class="tag tag--warn">не замечен</span>'
        : "";
  const scope =
    slice.competition_scope === "worldwide"
      ? ' <span class="tag tag--warn">всемирная</span>'
      : "";
  // Опорная страна означает рынок: у RU след приходит из BY, KZ и UA, а также
  // от кириллических материалов с любой регистрацией автора. Без состава это
  // число спорило бы с блоком «Где замечен» ниже на той же странице.
  //
  // Обёртка `raw` обязательна: `html` возвращает СТРОКУ, а подстановка строки
  // экранируется — вложенный шаблон без неё печатал тег буквами прямо в ячейку.
  // Содержимое при этом экранирует внутренний `html`, поэтому `raw` тут не дыра.
  const label = footprintLabel(slice.footprint, code);
  const footprint = label
    ? raw(html`<span class="regiontable__from">${label}</span>`)
    : "";
  return html`
    <tr>
      <td class="regiontable__code">${code}${raw(local)}</td>
      <td><b>${score(slice.opportunity)}</b>${raw(capped)}</td>
      <td>${score(slice.trend)}</td>
      <td>${score(slice.search)}${raw(script)}</td>
      <td>${score(slice.competition)}${raw(free)}${raw(scope)}</td>
      <td>${slice.mentions || 0}${footprint}</td>
      <td>${raw(checkLinks(title, code, { compact: true }))}</td>
    </tr>
  `;
}

function about(trend) {
  const facts = [
    ["Описание", trend.about],
    ["Почему взлетел", trend.why_popular],
  ].filter(([, value]) => value);

  return html`
    <div class="panel prose">
      ${raw(
        facts.length
          ? facts
              .map(
                ([label, value]) => html`
                  <p class="eyebrow">${label}</p>
                  <p>${value}</p>
                `,
              )
              .join("")
          : html`<p class="note">Описание появится после следующего разбора.</p>`,
      )}
      ${raw(listBlock("Связанные мемы", trend.related_memes))}
      ${raw(listBlock("Персонажи и объекты", trend.characters))}
      ${raw(listBlock("Другие написания", trend.aliases))}
      ${raw(sourcesBlock(trend))}
    </div>
  `;
}

function listBlock(title, values) {
  if (!values || !values.length) return "";
  return html`
    <p class="eyebrow">${title}</p>
    <div class="find__meta">
      ${raw(values.map((value) => html`<span class="tag">${value}</span>`).join(""))}
    </div>
  `;
}

function sourcesBlock(trend) {
  const links = (trend.evidence_urls || []).slice(0, 6);
  if (!trend.sources_seen?.length && !links.length) return "";
  return html`
    <p class="eyebrow">Где встречен</p>
    <div class="find__meta">
      ${raw((trend.sources_seen || []).map((s) => html`<span class="tag">${s}</span>`).join(""))}
    </div>
    ${raw(
      links.length
        ? html`<ul class="links">
            ${raw(
              links
                .map(
                  (url) =>
                    html`<li>
                      <a href="${url}" target="_blank" rel="noreferrer">${url}</a>
                    </li>`,
                )
                .join(""),
            )}
          </ul>`
        : "",
    )}
  `;
}

// У тренда две географии, и путать их нельзя — они отвечают на разные вопросы.
// «Где ищут» — поисковый интерес Google Trends, отвечает буквально, но бывает
// пустым: сервис регулярно отдаёт 429. «Где замечен» — счёт по нашим же
// упоминаниям, отвечает на «где про это говорят», зато есть всегда.
function geoBars(rows, valueKey) {
  const max = Math.max(...rows.map((r) => r[valueKey] || 0), 1);
  return rows
    .map(
      (item) => html`
        <li>
          <span class="geo__code">${item.code}</span>
          <span class="geo__bar">
            <i style="width:${raw(String(Math.round(((item[valueKey] || 0) / max) * 100)))}%"></i>
          </span>
          <span class="geo__value">${item[valueKey] || 0}</span>
          ${raw(originNote(item))}
        </li>
      `,
    )
    .join("");
}

/**
 * Из чего сложено число упоминаний по стране (фича 010).
 *
 * В одном столбце сходятся два разных факта: страна автора ролика и регион
 * выдачи, в которой ролик всплыл. У «Шедевростандофф» «US · 12» складывалось
 * из семи первых и пяти вторых, и первое место США читалось как утверждение
 * об аудитории, которым не было. Молчать об этом нельзя (конституция II).
 */
function originNote(item) {
  if (item.by_author === undefined) return "";
  const parts = [];
  if (item.by_author) parts.push(`${item.by_author} по автору`);
  if (item.by_feed) parts.push(`${item.by_feed} по выдаче`);
  if (item.by_unknown) parts.push(`${item.by_unknown} без пометки`);
  // Одна составляющая на всю строку — разбивать нечего.
  if (parts.length < 2) return "";
  return html`<span class="geo__origin">${parts.join(" · ")}</span>`;
}

function geo(trend) {
  const geoRows = trend.geo || [];
  if (!geoRows.length) {
    return html`<p class="note">
      Поисковый интерес не получен: Google Trends не ответил или тренд ещё не
      проверен. Это про сервис, а не про тренд — смотри «Где замечен».
    </p>`;
  }
  // Порегиональный добор (фича 010): всемирный запрос дал пустоту, и интерес
  // спрошен по каждой стране отдельно. Числа при этом нормированы каждое
  // внутри своей страны и между собой несравнимы — это признак присутствия,
  // а не объём, и подписать иначе значило бы соврать.
  const perRegion = geoRows.some((row) => row.per_region);
  return html`
    ${raw(
      perRegion
        ? html`<p class="note">
            По миру интереса не видно — спрошено по странам отдельно. Числа
            нормированы каждое внутри своей страны: это «ищут или нет»,
            сравнивать их между собой нельзя.
          </p>`
        : "",
    )}
    <ul class="geo">
      ${raw(geoBars(geoRows, "interest"))}
    </ul>
  `;
}

function regionsSeen(trend) {
  const rows = trend.regions_seen || [];
  if (!rows.length) {
    return html`<p class="note">Упоминаний с указанием региона пока нет.</p>`;
  }
  // GLOBAL стоит отдельной строкой: у TikTok он почти у всего, и в общем
  // столбике он подавил бы любую страну.
  const countries = rows.filter((r) => r.code !== "GLOBAL");
  const worldwide = rows.find((r) => r.code === "GLOBAL");
  return html`
    ${raw(
      worldwide
        ? html`<p class="note">
            Без привязки к стране: <b>${worldwide.mentions}</b> упоминаний.
          </p>`
        : "",
    )}
    ${raw(
      countries.length
        ? html`<ul class="geo">
            ${raw(geoBars(countries, "mentions"))}
          </ul>`
        : "",
    )}
  `;
}

function ideas(trend) {
  const list = trend.ideas || [];
  if (!list.length) {
    return html`
      <div class="empty">
        <b>Идей пока нет</b>
        <p>
          Прогон их не создаёт — идеи появляются только по твоей кнопке, чтобы
          квота модели уходила на те тренды, которые ты выбрал.
        </p>
        <p>
          <button class="cta" type="button" data-generate="${trend.slug}">
            ✨ Сгенерировать идеи
          </button>
        </p>
      </div>
    `;
  }
  return html`<ul class="ideas">
    ${raw(list.map(ideaCard).join(""))}
  </ul>`;
}

function ideaCard(idea) {
  return html`
    <li class="panel idea">
      <h3 class="idea__title">${idea.concept}</h3>
      <div class="find__meta">
        <span class="tag">${idea.genre}</span>
        <span class="tag">${idea.difficulty}</span>
      </div>
      ${raw(idea.why_now ? html`<p>${idea.why_now}</p>` : "")}
      ${raw(listBlock("Названия EN", idea.titles_en))}
      ${raw(listBlock("Названия RU", idea.titles_ru))}
    </li>
  `;
}
