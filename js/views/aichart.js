// Раздел «AI-чарт»: мнение модели рядом с фактами магазина (фича 006).
//
// Две колонки, и они устроены по-разному не для симметрии.
//
// Левая — прогноз по накопленной базе. Модель видит уже посчитанные показатели
// и объясняет, что из этого делать. Выдумать тренд она здесь не может: код
// сверяет идентификатор с реестром.
//
// Правая — гипотезы из её знаний. Веб-поиска у модели нет: замер 2026-08-03
// показал 429 на бесплатном тарифе при рабочих обычных вызовах, а без поиска
// она уверенно называет несуществующее. Поэтому каждое имя проверено кодом —
// зондом Google Play и подсказками, — и в колонке осталось только то, у чего
// есть след. «ИИ предложил, магазин подтвердил», а не «ИИ нашёл».
//
// Главное правило показа: посчитанное и сказанное различаются ФОРМОЙ, а не
// только подписью. Заливка — факт, контур — мнение. Через неделю работы
// одинаковые бейджи стали бы неразличимы, и мнение начало бы читаться как
// измеренное.

import { getAiChart, rebuildAiChart, addManualTrend } from "../api.js";
import { html, raw, dateLabel } from "../format.js";
import { sticker } from "../components/sticker.js";
import { stagger } from "../motion.js";
import { skeleton, skelCards } from "../components/skeleton.js";
import { regionFilter } from "../components/regionfilter.js";
import { applyFilters, bindListControls, listControls, makeState } from "../components/listcontrols.js";
import { queryParam, setQueryParam } from "../router.js";

const REJECT_LABELS = {
  already_known: "уже в базе",
  no_trace: "следа не нашлось",
  empty_name: "пустое имя",
};

const state = makeState("ai");
let chart = null;

export async function aiChartView(mount) {
  const savedRegion = queryParam("region");
  if (savedRegion) state.filters.region = savedRegion;

  mount.insertAdjacentHTML(
    "beforeend",
    html`
      <header class="view-head">
        <div>
          <p class="eyebrow">Мнение модели</p>
          <h1 class="view-title">AI-чарт</h1>
        </div>
        <button class="cta cta--ghost" type="button" id="rebuild">Пересобрать</button>
      </header>
      <p class="runline" id="chart-meta"></p>
      <div class="section" id="chart" aria-busy="true">
        <p class="sr-only" role="status">Загружаю…</p>
        ${raw(skeleton(skelCards(6)))}
      </div>
    `,
  );

  const target = mount.querySelector("#chart");
  try {
    chart = await getAiChart();
  } catch (error) {
    target.removeAttribute("aria-busy");
    target.innerHTML = html`<div class="alert">${error.message}</div>`;
    return;
  }
  target.removeAttribute("aria-busy");
  render(mount, target);
  bindRebuild(mount, target);
}

function render(mount, target) {
  const meta = mount.querySelector("#chart-meta");
  meta.innerHTML = chart.ts
    ? html`Собран ${dateLabel(chart.ts)} моделью ${chart.model || "—"}.${raw(
        chart.stale
          ? html` <b>Данные не свежие</b> — нажми «Пересобрать», если нужен
              разбор по сегодняшней базе.`
          : "",
      )}`
    : "Чарт ещё не собирался. Он появится после ближайшего прогона.";

  const forecast = chart.forecast || [];
  const hypotheses = chart.hypotheses || [];
  const filters = [regionFilter(forecast)];
  const shownForecast = applyFilters(forecast, state, filters);

  target.innerHTML = html`
    ${raw(forecast.length ? listControls(state, { sorts: [{ value: "ai", label: "по мнению модели" }], filters, total: forecast.length, shown: shownForecast.length }) : "")}
    <div class="aichart">
      <div class="aichart__col">
        <h2 class="eyebrow">Прогноз по базе</h2>
        <p class="note">
          Модель смотрит на твои посчитанные показатели и объясняет, за что
          браться. Идентификаторы сверены с реестром — придуманных трендов тут
          быть не может.
        </p>
        ${raw(
          shownForecast.length
            ? html`<ul class="finds rise-list">
                ${raw(shownForecast.map(forecastCard).join(""))}
              </ul>`
            : html`<div class="empty"><b>Пусто</b><p>Модель ничего не выбрала.</p></div>`,
        )}
      </div>

      <div class="aichart__col">
        <h2 class="eyebrow">Гипотезы ИИ</h2>
        <p class="note">
          Это <b>не находки, а догадки из памяти модели</b>: доступа к вебу у неё
          нет. Каждое имя проверено в Google Play и в подсказках поиска —
          осталось только то, у чего нашёлся реальный след.
        </p>
        ${raw(
          hypotheses.length
            ? html`<ul class="finds rise-list">
                ${raw(hypotheses.map(hypothesisCard).join(""))}
              </ul>`
            : html`<div class="empty">
                <b>Ни одна гипотеза не прошла проверку</b>
                <p>Это тоже результат: он показывает, насколько модель выдумывает.</p>
              </div>`,
        )}
        ${raw(rejectedBlock(chart.rejected || []))}
      </div>
    </div>
  `;

  if (forecast.length) {
    bindListControls(target, state, () => {
      setQueryParam("region", state.filters.region || "all");
      render(mount, target);
    });
  }
  bindAdd(target);
  target.querySelectorAll(".rise-list").forEach((list) => stagger(list));
}

function forecastCard(row) {
  return html`
    <li class="find">
      <div>
        <a class="find__name" href="#/trend/${encodeURIComponent(row.slug)}">${row.title}</a>
        <div class="find__meta">
          <span class="tag">${row.horizon || "—"}</span>
          ${raw(row.regions?.length ? html`<span class="tag">${row.regions[0]}</span>` : "")}
        </div>
        <p class="note">${row.verdict_ru}</p>
        ${raw(row.risk_ru ? html`<p class="note">Риск: ${row.risk_ru}</p>` : "")}
        ${raw(row.game_hint_ru ? html`<p class="note">Механика: ${row.game_hint_ru}</p>` : "")}
      </div>
      <div class="find__scores">
        ${raw(
          sticker({
            opportunity: row.opportunity,
            niche_free: row.niche_free,
            // Позиция чарта берётся только из реестра, а туда попадают и
            // непроверенные тренды. Наклейка честно скажет «не проверен».
            verified: row.opportunity !== null && row.opportunity !== undefined,
          }),
        )}
        ${raw(opinionBadge(row.ai_score))}
      </div>
    </li>
  `;
}

function hypothesisCard(row) {
  const e = row.evidence || {};
  return html`
    <li class="find">
      <div>
        <p class="find__name">${row.name}</p>
        <div class="find__meta">
          <span class="tag">${row.type || "other"}</span>
          <span class="tag">гипотеза</span>
        </div>
        <p class="note">${row.why_ru}</p>
        ${raw(row.where_ru ? html`<p class="note">Где живёт: ${row.where_ru}</p>` : "")}
        <p class="note">${raw(traceLabel(e))}</p>
      </div>
      <button class="cta cta--ghost" type="button" data-add="${row.name}">
        ↑ В тренды
      </button>
    </li>
  `;
}

// Новой числовой шкалы здесь нет намеренно: у гипотезы нет ни полной проверки,
// ни истории, и любое число рядом с Opportunity читалось бы как сравнимое с ним.
function traceLabel(e) {
  const parts = [];
  if (e.exact_titles) {
    parts.push(
      `имя заняли ${e.exact_titles} прил., крупнейшее «${e.top_exact_title}» — ${installs(e.top_exact_installs)}`,
    );
  }
  if (e.suggest_count) parts.push(`${e.suggest_count} подсказок Google Play`);
  return parts.length ? `След: ${parts.join("; ")}` : "След не найден";
}

function installs(value) {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)} млн установок`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} тыс. установок`;
  return `${n} установок`;
}

function opinionBadge(score) {
  return html`<span class="opinion" title="Оценка модели, а не расчёт">
    <b>${score ?? "—"}</b><span>прогноз ИИ</span>
  </span>`;
}

// Отсеянные показываются по требованию. Они нужны не для полноты, а чтобы
// через месяц было измерено, насколько модель выдумывает.
//
// «Следа не нашлось» — не приговор, а отсутствие данных: зонд смотрит только
// в Google Play и подсказки, а явление может жить в Discord или чатах, куда
// зонд не достаёт. Поэтому у таких строк есть та же кнопка «В тренды»:
// последнее слово за человеком, и его решение не должно упираться в сито.
function rejectedBlock(rejected) {
  if (!rejected.length) return "";
  return html`
    <details class="rejected">
      <summary>Отсеяно: ${rejected.length}</summary>
      <ul>
        ${raw(
          rejected
            .map(
              (row) => html`<li>
                <b>${row.name}</b> — ${REJECT_LABELS[row.reason] || row.reason}
                ${raw(
                  row.reason === "no_trace" && row.name
                    ? html` <button class="cta cta--ghost" type="button"
                        data-add="${row.name}">↑ В тренды</button>`
                    : "",
                )}
              </li>`,
            )
            .join(""),
        )}
      </ul>
    </details>
  `;
}

function bindAdd(target) {
  target.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Вношу…";
      try {
        const result = await addManualTrend(button.dataset.add, "из гипотез ИИ");
        button.textContent = result.created
          ? "✓ внесён"
          : `✓ уже есть: «${result.title || result.slug}»`;
      } catch (error) {
        button.disabled = false;
        button.textContent = error.message;
      }
    });
  });
}

function bindRebuild(mount, target) {
  const button = mount.querySelector("#rebuild");
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Собираю…";
    try {
      chart = await rebuildAiChart();
      render(mount, target);
      bindRebuild(mount, target);
    } catch (error) {
      target.insertAdjacentHTML("afterbegin", html`<div class="alert">${error.message}</div>`);
    } finally {
      button.disabled = false;
      button.textContent = "Пересобрать";
    }
  });
}
