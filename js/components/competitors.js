// Разбор магазина: кто уже занял нишу и что осталось свободным (FR-014).
//
// «Точное название» — не украшение таблицы, а главный факт для органики: если
// имя тренда уже стоит в заголовке чужой игры, поиск отдаст трафик ей.

import { daysSince, html, raw } from "../format.js";

function measuredText(market) {
  return `Замер с IP: ${market?.measured_from || "неизвестно"}. Выдача RU, BR, ID показана оттуда, листинги с гео-запретом не видны.`;
}

/** Подпись замера (N12): IP определяет, какие листинги видны, а не параметр страны. */
export function measuredLine(market) {
  return html`<p class="note">${measuredText(market)}</p>`;
}

/**
 * Оговорка к словам «ниша свободна» в регионе RU, подсказкой (N12). У строки списка IP замера
 * нет, и страну подсказка не выдумывает: остаётся сама оговорка.
 */
export function ruFreeHint(market) {
  return market?.measured_from
    ? measuredText(market)
    : "Выдача RU показана с IP замера: листинги с гео-запретом оттуда не видны.";
}

/**
 * Заголовок раздела Google Play (Р14): когда снят замер магазина и сколько дней назад.
 * Раньше раздел назывался просто «Google Play», и месячный замер выглядел сегодняшним.
 */
export function marketHeading(market, now = Date.now()) {
  if (!market) return "Магазин ещё не замерен";
  const iso = String(market.verified_at || "");
  const days = daysSince(iso, now);
  if (days === null) return "Замер магазина: дата неизвестна";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `Замер магазина: ${day}.${month}.${year} (${days} дн. назад)`;
}

export function competitors(market) {
  if (!market) {
    return html`<p class="note">
      Магазин по этому тренду ещё не проверялся. Проверка идёт в следующем прогоне.
    </p>`;
  }

  const rows = market.competitors || [];
  // «Обновлена» была «неизвестно» в 22 593 строках из 22 593: пустой столбец прячется (Р14).
  const hasUpdated = rows.some((app) => app.updated_days_ago !== null && app.updated_days_ago !== undefined);
  return html`
    <div class="market">
      ${raw(measuredLine(market))}
      <dl class="scorebar">
        ${raw(fact("связаны с именем", market.relevant_count ?? rows.length))}
        ${raw(fact("имя занято", market.exact_title_matches))}
        ${raw(fact("всего в выдаче", market.results_count))}
        ${raw(
          fact(
            // Мера выдачи, а не вердикт о нише: о нише говорит балл Возможности (спека O4).
            "выдача Play",
            market.competitors_hidden
              ? "конкуренты не видны"
              : market.niche_free
                ? "свободна"
                : "занята",
            market.competitors_hidden
              ? "tag--warn"
              : market.niche_free
                ? "tag--free"
                : "tag--taken",
          ),
        )}
      </dl>

      ${raw(
        market.competitors_hidden
          ? html`<p class="note">
              Поиск из локали замера${market.measured_from ? ` (${market.measured_from})` : ""}
              не видит ${rows.length ? "этих конкурентов" : "ни одного конкурента"},
              но подсказок с именем — ${market.demand_count}: листинги существуют
              и скрыты гео-таргетингом разработчиков.${rows.length
                ? " Список собран через APKPure; установки гео-запертых Play не отдаёт, поэтому у них прочерк."
                : " Ноль конкуренции здесь был бы ложью, поэтому ярлык «свободна» снят."}
            </p>`
          : "",
      )}

      ${raw(
        rows.length
          ? html`<div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>Игра</th>
                    <th>Установки</th>
                    <th>Оценка</th>
                    ${raw(hasUpdated ? "<th>Обновлена</th>" : "")}
                    <th>Имя тренда</th>
                  </tr>
                </thead>
                <tbody>
                  ${raw(rows.map((app) => row(app, hasUpdated)).join(""))}
                </tbody>
              </table>
            </div>`
          : html`<p class="note">
              Магазин вернул ${market.results_count} приложений, и ни одно
              не связано с этим именем.${market.competitors_hidden
                ? " Свободной нишу это не делает — см. пометку выше."
                : " Ниша свободна."}
            </p>`,
      )}

      ${raw(chips("Свободные связки названий", market.free_title_combos, "tag--free"))}
      ${raw(chips("Подсказки Google Play", market.suggest_phrases))}
    </div>
  `;
}

function row(app, hasUpdated = true) {
  // Конкурент из стороннего индекса: поиск Play его не видит из локали
  // замера, а установки честно неизвестны — методика видна прямо в строке.
  const via = app.source === "apkpure"
    ? ' <span class="tag">APKPure</span>'
    : "";
  return html`
    <tr>
      <td>
        <a href="https://play.google.com/store/apps/details?id=${app.appId}"
           target="_blank" rel="noreferrer">${app.title}</a>${raw(via)}
      </td>
      <td>${installs(app.installs)}</td>
      <td>${app.score ? Number(app.score).toFixed(1) : "—"}</td>
      ${raw(hasUpdated ? html`<td>${updated(app.updated_days_ago)}</td>` : "")}
      <td>${raw(app.exact_title ? '<span class="tag tag--taken">занято</span>' : "—")}</td>
    </tr>
  `;
}

function installs(value) {
  const number = Number(value || 0);
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M+`;
  if (number >= 1_000) return `${Math.round(number / 1000)}K+`;
  return number ? `${number}+` : "—";
}

function updated(days) {
  if (days === null || days === undefined) return "неизвестно";
  if (days === 0) return "сегодня";
  return `${days} дн. назад`;
}

function fact(label, value, className = "") {
  return html`
    <div class="metric">
      <dt class="metric__label">${label}</dt>
      <dd class="metric__value ${raw(className)}">${value}</dd>
    </div>
  `;
}

function chips(title, values, className = "") {
  if (!values || !values.length) return "";
  return html`
    <div class="chips">
      <p class="eyebrow">${title}</p>
      <div class="find__meta">
        ${raw(values.map((value) => html`<span class="tag ${raw(className)}">${value}</span>`).join(""))}
      </div>
    </div>
  `;
}
