// Вид «Брать» (NI-2, 2026-11-10): порядок v2 внутри правил владельца.
//
// Решение «прошла строка правила или нет» принимает сервер при сборке индекса
// (`registry/owner_view.py`) и кладёт в строку коды причин `owner_hold`. Клиент не пересчитывает
// правила: иначе два места разошлись бы, как расходились копии формулы. Здесь только тексты по
// кодам (общий вектор с Python: tests/fixtures/owner_view_vector.json), бейджи из готовых полей
// строки и переключатель «Брать | Все по v2».

import { html, raw } from "../format.js";

/** Тексты причин; зеркало `owner_view.REASON_TEXT`. Давность подставляет порог. */
export const REASON_TEXT = {
  no_suggest: "Play не подсказывает имя",
  suggest_unknown: "подсказки Play ещё не мерили",
  red_ip: "красный флаг прав",
  common_word: "частое слово",
  common_phrase: "частая фраза",
  stale: "замер старше срока",
  suspect: "замер подозрителен",
};

export const STALE_DAYS = 14;

export const VIEWS = [
  { value: "take", label: "Брать" },
  { value: "all", label: "Все по v2" },
];

/** Ушла ли строка в «Проверить»: у неё есть коды причин. */
export function isHeld(row) {
  return Array.isArray(row?.owner_hold) && row.owner_hold.length > 0;
}

export function reasonText(code, staleDays = STALE_DAYS) {
  return code === "stale" ? `замер старше ${staleDays} дн` : REASON_TEXT[code] || code;
}

/** «Play не подсказывает имя; замер старше 14 дн» - причины строки одной фразой. */
export function holdWhy(row, staleDays = STALE_DAYS) {
  return (row?.owner_hold || []).map((code) => reasonText(code, staleDays)).join("; ");
}

function installsShort(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return null;
  const value = Number(n);
  if (value >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}M`.replace(".", ",");
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

/**
 * Бейджи строки из готовых данных индекса. Нет данных - нет бейджа: неизвестное не рисуется
 * нулём. «Замер N дн» не здесь: его уже даёт `measureAgeTag` (порог из сводки прогона).
 */
export function ownerBadges(row) {
  const badges = [];
  const top = row?.top10_days;
  if (Array.isArray(top) && top.length === 2 && top[0] > 0) {
    badges.push(`в топ-10 ${top[0]} из ${top[1]} дн`);
  }
  const parts = row?.proven_demand_parts;
  if (parts && parts.games !== undefined && parts.games !== null) {
    const leader = installsShort(parts.top);
    badges.push(`точных игр ${parts.games}${leader ? `, лидер ${leader}` : ""}`);
  }
  if (row?.unmet_found_at && row?.unmet_term_len) {
    badges.push(`с ${row.unmet_found_at} из ${row.unmet_term_len} букв`);
  }
  return badges;
}

export function ownerTags(row, staleDays = STALE_DAYS) {
  const tags = ownerBadges(row).map((text) => html`<span class="tag">${text}</span>`);
  if (isHeld(row)) {
    tags.unshift(html`<span class="tag tag--warn" title="${holdWhy(row, staleDays)}">Проверить: ${holdWhy(row, staleDays)}</span>`);
  }
  return tags.join("");
}

/** Заголовок блока «Проверить» над первой ушедшей строкой страницы. */
export function holdHeader(count) {
  return html`<li class="find find--note"><p class="runline">Проверить (${count}): имена ниже не прошли
    правила владельца, причина указана у каждого. Порядок внутри - прежний, по v2.</p></li>`;
}

/** Переключатель «Вид: Брать | Все по v2». */
export function ownerSwitch(active) {
  return html`
    <div class="regions" role="group" aria-label="Вид списка">
      <span class="regions__label">Вид</span>
      ${raw(
        VIEWS.map(
          (view) => html`
            <button type="button" class="regions__pill" data-owner-view="${view.value}"
              aria-pressed="${view.value === active}">${view.label}</button>
          `,
        ).join(""),
      )}
    </div>
  `;
}
