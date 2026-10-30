// Наклейка с Opportunity — единственный громкий элемент интерфейса.
//
// Цвет здесь не украшение: лайм — ниша свободна, розовый — занята. Список
// читается цветом раньше, чем цифрами. Третьего цвета в наклейке нет и быть
// не должно, иначе смысл превратится в декорацию.
//
// Поэтому деления шкалы (фича 011) подписаны СЛОВОМ, а не покрашены: цвет уже
// занят под свободу ниши, и второй смысл на нём означал бы, что не читается
// ни один. Слово нужно затем, что потолок 100 недостижим по построению —
// «19» на самом деле верхняя треть, а выглядит как «почти ноль».

import { html, raw } from "../format.js";

/** Подпись деления по порогам из конфига (`scoring.bands`). */
export function bandLabel(value, bands) {
  if (value === null || value === undefined || !bands) return "";
  if (bands.strong !== undefined && value >= bands.strong) return "сильно";
  if (bands.decent !== undefined && value >= bands.decent) return "прилично";
  return "";
}

/**
 * @param {{opportunity: number|null, verified: boolean, niche_free: boolean}} row
 * @param {{large?: boolean, bands?: object, metric?: {key: string, label: string}}} options
 *
 * `metric` существует потому, что списков стало три (фича 011). Наклейка
 * обязана показывать ту величину, которой список отсортирован: в «Из этого
 * выйдет игра» рыночный балл ставил бы 33 выше 52 и выглядел бы ошибкой.
 */
export function sticker(row, { large = false, bands = null, metric = null } = {}) {
  const key = metric?.key || "opportunity";
  const label = metric?.label || "Opportunity";
  const size = large ? "sticker--lg" : "";
  // Проверка магазина нужна только тем величинам, которые из него выведены.
  // Сигнал источников существует и у непроверенного тренда, и показывать
  // вместо него прочерк значило бы соврать в списке «Громкие сейчас».
  const known = row[key] !== null && row[key] !== undefined;
  const shown = known && (key === "trend" || row.verified === true);
  const world = worldLine(row, key);

  if (!shown) {
    // Прочерк с «мир: N» под ним — не противоречие: срез региона старее
    // замера спроса магазина, и балла у него нет, а всемирный существует.
    // Молчать о нём значило бы спрятать единственное известное число.
    return html`<div
      class="sticker sticker--unknown ${raw(size)}"
      title="${world
        ? `Балл по ${row.region} не посчитан — срез снят до замера спроса магазина`
        : "Магазин ещё не проверен — Opportunity не считается"}"
    >
      <span class="sticker__value">—</span>
      <span class="sticker__label">не проверен</span>
      ${raw(world)}
    </div>`;
  }

  // Цвет — утверждение о нише, поэтому его имеет право ставить только
  // проверенный тренд. До 2026-08-05 условие стояло выше, вместе с показом
  // значения, и в списке «Громкие сейчас» 155 строк из 352 получали розовую
  // наклейку «Ниша занята», ни разу не побывав в магазине. Серая наклейка
  // показывает число и молчит о нише — ровно то, что мы про неё знаем.
  const checked = row.verified === true;
  const taken = checked && !row.niche_free;
  const tone = checked ? (taken ? "sticker--taken" : "") : "sticker--unknown";
  const note = checked
    ? taken
      ? "Ниша занята"
      : "Ниша свободна"
    : "Ниша ещё не проверена";
  // Деления замерены для рыночного балла (scoring.bands). У GameFit своё
  // распределение — вдвое ниже, — и та же подпись врала бы.
  const band = key === "opportunity" ? bandLabel(row[key], bands) : "";
  return html`<div
    class="sticker ${raw(tone)} ${raw(size)}"
    title="${note}"
  >
    <span class="sticker__value">${row[key]}</span>
    <span class="sticker__label">${label}</span>
    ${raw(band ? html`<span class="sticker__band">${band}</span>` : "")}
    ${raw(world)}
  </div>`;
}

/**
 * Всемирный балл под региональным (`row.world` кладёт rowForRegion).
 *
 * Метрика та же, что у большого числа: под «Игра 31» рыночная цифра из
 * другой шкалы читалась бы как сравнение, которым не является. При равенстве
 * строка не прячется — подпись «мир:» сама снимает двусмысленность, а её
 * исчезновение читалось бы как пропажа данных.
 */
function worldLine(row, key) {
  const value = row.world?.[key];
  if (value === null || value === undefined) return "";
  return html`<span class="sticker__world">мир: ${value}</span>`;
}
