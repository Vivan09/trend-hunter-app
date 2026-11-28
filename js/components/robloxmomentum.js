// Строка импульса Roblox на карточке тренда (W-5, 2026-11-09).
//
// «Roblox: онлайн ×3 за 3 дня, +420 визитов в час». Читает `trend.roblox_place.momentum`,
// который пишет Python (`discovery/roblox_series.roblox_momentum`). Нет импульса или в нём
// нет ни одной известной цифры — пустая строка: «не знаем» не рисуется нулём (конституция II).

import { escapeHtml, fixedHalfEven, plural, roundHalfEven } from "../format.js";

function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Текст без разметки; `null`, если сказать нечего. Вынесено ради теста. */
export function robloxMomentumText(place) {
  const m = place?.momentum;
  if (!m || typeof m !== "object") return null;
  const parts = [];
  const growth = num(m.playing_growth);
  const hours = num(m.hours);
  const days = hours === null ? 3 : Math.max(1, Math.round(hours / 24));
  if (growth !== null) {
    const shown = fixedHalfEven(growth, 1).replace(/\.0$/, "").replace(".", ",");
    parts.push(`онлайн ×${shown} за ${days} ${plural(days, "день", "дня", "дней")}`);
  }
  const visits = num(m.visits_per_hour);
  if (visits !== null && visits > 0) {
    parts.push(`+${roundHalfEven(visits)} ${plural(roundHalfEven(visits), "визит", "визита", "визитов")} в час`);
  }
  return parts.length ? `Roblox: ${parts.join(", ")}` : null;
}

export function robloxMomentumLine(place) {
  const text = robloxMomentumText(place);
  return text ? `<p class="note">${escapeHtml(text)}</p>` : "";
}
