// Наклейка с баллом «Возможность» — единственный громкий элемент интерфейса.
//
// Цвет здесь не украшение: лайм — ниша свободна, розовый — занята. Список
// читается цветом раньше, чем цифрами. Третьего цвета в наклейке нет и быть
// не должно, иначе смысл превратится в декорацию.
//
// На балле «Возможность» (Opportunity v2) те же цвета говорят языком его формулы:
// розовый — ниша насыщена (сработала поправка за лидера), лайм — не насыщена. Иначе
// наклейка спорит со своей строкой: старая `niche_free` меряет похожие имена в выдаче
// и звала занятыми 35 из верхних 40 строк, где сильных игр ещё нет (спека O4).
//
// Поэтому деления шкалы (фича 011) подписаны СЛОВОМ, а не покрашены: цвет уже
// занят под свободу ниши, и второй смысл на нём означал бы, что не читается
// ни один. Слово нужно затем, что потолок 100 недостижим по построению —
// «19» на самом деле верхняя треть, а выглядит как «почти ноль».

import { html, raw, volumeLabel } from "../format.js";
import { ruFreeHint } from "./competitors.js";
import { nicheOf } from "./opportunity.js";

const V2_NICHE = {
  saturated: { tone: "sticker--taken", note: "Ниша насыщена" },
  blind: { tone: "sticker--unknown", note: "Конкуренты не видны" },
  open: { tone: "", note: "Ниша не насыщена" },
};

/** Цвет и подпись наклейки: что величина списка говорит о нише. */
function nicheLook(row, key) {
  if (row.verified !== true) return { tone: "sticker--unknown", note: "Ниша ещё не проверена" };
  if (key === "opportunity_v2") return V2_NICHE[nicheOf(row)];
  return row.niche_free
    ? { tone: "", note: row.region === "RU" ? `Ниша свободна. ${ruFreeHint()}` : "Ниша свободна" }
    : { tone: "sticker--taken", note: "Ниша занята" };
}

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
  const key = metric?.key || "opportunity_v2";
  const label = metric?.label || "Возможность";
  const size = large ? "sticker--lg" : "";
  // Проверка магазина нужна только тем величинам, которые из него выведены.
  // Сигнал источников существует и у непроверенного тренда, и показывать
  // вместо него прочерк значило бы соврать в списке «Громкие сейчас».
  const known = row[key] !== null && row[key] !== undefined;
  // Поиск Google — тоже не рыночный балл: Keyword Planner мерит имя, а не
  // нишу, и тренд, не проверенный в Play, имеет на него полное право.
  const google = key === "kp_volume";
  // У `opportunity_v2` балл есть только у проверенного рынка: `None` и есть «не проверен».
  const shown = known && (key === "trend" || key === "opportunity_v2" || google || row.verified === true);
  const world = google ? "" : worldLine(row, key);

  if (!shown) {
    // Прочерк с «мир: N» под ним — не противоречие: срез региона старее
    // замера спроса магазина, и балла у него нет, а всемирный существует.
    // Молчать о нём значило бы спрятать единственное известное число.
    return html`<div
      class="sticker sticker--unknown ${raw(size)}"
      title="${world
        ? `Балл по ${row.region} не посчитан — срез снят до замера спроса магазина`
        : "Магазин ещё не проверен — балл не считается"}"
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
  if (google) {
    // Серая наклейка без слов о нише: объём поиска про имя, не про магазин.
    return html`<div
      class="sticker sticker--unknown ${raw(size)}"
      title="Поисков в месяц в Google (Keyword Planner)"
    >
      <span class="sticker__value">${volumeLabel(row[key])}</span>
      <span class="sticker__label">${label}</span>
    </div>`;
  }
  const { tone, note } = nicheLook(row, key);
  // Деления замерены для рыночного балла (scoring.bands). У GameFit своё
  // распределение — вдвое ниже, — и та же подпись врала бы.
  const band = key === "opportunity" || key === "opportunity_v2" ? bandLabel(row[key], bands) : "";
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
