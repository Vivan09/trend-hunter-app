// Допуск тренда в списки: ok / risk / junk (P0-A, 2026-11-04).
//
// Класс считает сервер при пересборке индекса (trendhunter/registry/
// eligibility.py), клиент только читает. Замер 2026-11-04 по живой базе:
// из первой десятки Opportunity половина — реальные люди (lsplash,
// alanzoka), треть — чужие франшизы (Hermitcraft), остальное — смех из чата
// Twitch. Людей и чужую IP Google Play снимает за имперсонацию, смех — вообще
// не имя явления. Ничего не удаляется: риск — отдельный видимый список,
// мусор находится поиском.
//
// Строка индекса разреженная: класс ok и пустая причина не пишутся (иначе
// список не влезает в бюджет размера, tests/integration/test_index_scale.py).
// Поэтому главное правило здесь — нет поля, значит ok, — и оно же держит
// старые trends.json, где полей допуска не было вовсе.

import { html } from "./format.js";

export const OK = "ok";
export const RISK = "risk";
export const JUNK = "junk";

export const REASON_LABELS = {
  person: "реальный человек",
  holder: "правообладатель защищает имя",
  ip: "чужая франшиза или бренд",
  override: "решение вручную",
  laughter: "смех из чата",
  stopwords: "служебные слова",
  short: "слишком короткое имя",
  handle: "ник создателя",
  number: "просто число",
  empty: "пустое имя",
};

// Подсказка общая для красного, жёлтого и «не проверен» (N10): это эвристика, не вывод юриста.
export const RIGHTS_HINT =
  "Эвристика, а не юридическая оценка: проверьте имя в USPTO и ФИПС, используйте свой арт и своё слово-бренд";

export function eligibilityOf(row) {
  return (row && row.eligibility) || OK;
}

/**
 * Доля риска: `person` или `ip`; не риск — "". Решение человека «risk»
 * делится по типу явления — то же правило, что `eligibility.risk_group`
 * в Python, иначе доли не сходились бы с риском (240 + 473 при 717).
 */
export function riskGroup(row) {
  if (eligibilityOf(row) !== RISK) return "";
  const reason = row.eligibility_reason || "";
  if (reason === "person" || reason === "ip") return reason;
  // Красное имя из списка прав — всегда чужая марка, даже если тип «человек» (как в Python).
  if (reason === "holder") return "ip";
  return row.content_type === "person" ? "person" : "ip";
}

/** Основной список — то же, что `ranking.is_listed`: активен, не «одни новости дня», ok. */
export function isListed(row) {
  return row.active !== false && !row.confirm_only && eligibilityOf(row) === OK;
}

function reasonLabel(reason) {
  return REASON_LABELS[reason] || reason || "";
}

/**
 * Метка класса рядом с типом явления.
 *
 * Риск — предупреждение: это решение «не брать имя», и оно должно читаться
 * издалека. Мусор — спокойная метка: он не опасен, он просто не имя, и
 * виден только тому, кто его искал. У старой строки без полей допуска —
 * прежняя пометка «чужое имя» по foreign_ip (фича 003). У ok — ничего: в том
 * числе когда человек сам допустил имя, которое модель назвала чужим.
 *
 * Красный (N10) виден в основном списке и в риске: строка остаётся на месте, а риск и его
 * причину показывает метка. Это та же строка, что `digest._ip_mark` в Python.
 */
export function eligibilityTag(row) {
  const kind = eligibilityOf(row);
  const reason = reasonLabel(row?.eligibility_reason);
  // Строка списка несёт ip_level/ip_why, карточка — rights.{level, reasons}.
  const level = row?.ip_level || row?.rights?.level || "";
  const why = row?.ip_why || row?.rights?.reasons?.[0] || "";
  if (level === "red" && (kind === OK || kind === RISK)) {
    const text = why ? `⛔ чужое имя: ${why}` : "⛔ чужое имя";
    return html`<span class="tag tag--danger" title="${RIGHTS_HINT}">${text}</span>`;
  }
  if (kind === RISK) {
    return html`<span class="tag tag--warn">риск: ${reason || "чужое имя"}</span>`;
  }
  if (kind === JUNK) return html`<span class="tag">мусор: ${reason || "не имя"}</span>`;
  if (kind !== OK) return html`<span class="tag">${kind}</span>`;
  if (!row?.eligibility && row?.foreign_ip) {
    return '<span class="tag tag--warn">чужое имя</span>';
  }
  if (level === "yellow") {
    return html`<span class="tag tag--warn" title="${RIGHTS_HINT}">осторожно: ${why}</span>`;
  }
  // Только null: undefined — старая строка без поля, про неё ничего не известно.
  if (row?.foreign_ip === null) {
    return html`<span class="tag" title="${RIGHTS_HINT}">IP не проверен</span>`;
  }
  return "";
}

/**
 * Счёт классов — та же форма, что `eligibility.pool_counts` в Python:
 * {ok, risk, junk, person, ip}. По умолчанию — только активные, как строка
 * дайджеста «Вне списков: N», на которую человек сверяется.
 */
export function poolCounts(rows, { activeOnly = true } = {}) {
  const counts = { ok: 0, risk: 0, junk: 0, person: 0, ip: 0 };
  for (const row of rows || []) {
    if (activeOnly && row.active === false) continue;
    const kind = eligibilityOf(row);
    if (kind !== OK && kind !== RISK && kind !== JUNK) continue;
    counts[kind] += 1;
    if (kind === RISK) counts[riskGroup(row)] += 1;
  }
  return counts;
}
