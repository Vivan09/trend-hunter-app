// Переключатель региона (фича 011).
//
// Стоит наверху раздела, а не в выпадашке фильтров, и это не вопрос вкуса:
// фильтр прячет строки, а регион ПЕРЕСЧИТЫВАЕТ баллы. Два разных действия
// в одном месте читались бы как одно.
//
// Считать здесь нечего: пайплайн уже положил в строку готовый срез по каждому
// опорному региону. Дашборд только выбирает, какой из них показать, — иначе
// одно и то же число считалось бы дважды по разным правилам.

import { html, raw } from "../format.js";

export const WORLD = "all";

// Порядок постоянный, а не по числу трендов: переключатель — это место, куда
// целятся мышью не глядя, и прыгающие пункты сделали бы его непригодным.
export const REGIONS = [
  { value: WORLD, label: "Весь мир" },
  { value: "US", label: "US" },
  { value: "RU", label: "RU" },
  { value: "BR", label: "BR" },
  { value: "ID", label: "ID" },
  { value: "GB", label: "GB" },
];

// Поля, которые регион подменяет. Список явный, а не «всё, что пришло»:
// случайный ключ среза не должен молча перекрыть поле строки списка.
// Экспортирован ради теста: список трендов сортируется по этим же полям,
// и порядок «по спросу» при выбранной стране обязан быть страновым.
export const REPLACED = [
  "trend",
  "search",
  "play",
  "play_count",
  "interest",
  "search_partial",
  "competition",
  "niche_free",
  "competition_scope",
  "growth",
  "growth_measurable",
  "opportunity",
  "game_fit",
  "phase",
];

/**
 * Строка списка в системе координат выбранного региона.
 *
 * `region_data: false` означает, что тренд не пересчитывали после фичи 011 —
 * его срез появится после ближайшей перепроверки в магазине. Показываем
 * всемирные числа и говорим об этом вслух, а не подсовываем их молча.
 *
 * @param {object} row строка индекса
 * @param {string} region код региона или WORLD
 */
export function rowForRegion(row, region) {
  if (!region || region === WORLD) {
    return { ...row, region: WORLD, region_data: true, local_signal: true, local_measurable: true };
  }
  const slice = (row.by_region || {})[region];
  if (!slice) {
    // Непересчитанный тренд говорит о себе через `region_data`, и выдавать
    // его за слепое пятно нельзя: это разные незнания.
    return {
      ...row, region, region_data: false,
      local_signal: false, local_measurable: true, region_mentions: 0,
      region_footprint: {},
    };
  }
  const replaced = {};
  for (const key of REPLACED) {
    if (slice[key] !== undefined) replaced[key] = slice[key];
  }
  return {
    ...row,
    ...replaced,
    region,
    region_data: true,
    // Всемирные баллы до подмены: рядом с региональным числом обязан стоять
    // всемирный ориентир, иначе «сколько тренд стоит в RU» не с чем сравнить.
    // У «Весь мир» и непересчитанных поля нет — там большое число и так
    // всемирное, и вторая копия читалась бы как ошибка.
    world: { opportunity: row.opportunity, game_fit: row.game_fit, trend: row.trend },
    local_signal: slice.local_signal !== false,
    // Отсутствие поля — записи до слепых пятен: они считались замером,
    // и задним числом объявлять их непроверяемыми нельзя.
    local_measurable: slice.local_measurable !== false,
    region_mentions: slice.mentions || 0,
    // Из каких стран собран счёт. Опорная страна означает РЫНОК (2026-08-08):
    // у RU след приходит из BY, KZ, UA и от кириллических материалов с любой
    // регистрацией автора. Без состава подпись «RU: 46» противоречила бы
    // блоку «Где замечен» на той же странице, где стоит сырое «RU: 0, BY: 49».
    region_footprint: slice.footprint || {},
  };
}

/**
 * Состав следа словами: `{BY: 22, KZ: 9}` → «BY 22, KZ 9».
 *
 * Пусто, когда весь след и так лежит в самой опорной стране: повторять
 * «RU 46» рядом с «46» незачем.
 *
 * @param {object} footprint страна → материалов
 * @param {string} region код опорной страны
 */
export function footprintLabel(footprint, region) {
  const pairs = Object.entries(footprint || {}).filter(([, count]) => count > 0);
  if (!pairs.length) return "";
  if (pairs.length === 1 && pairs[0][0] === region) return "";
  return pairs
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([code, count]) => `${code} ${count}`)
    .join(", ");
}

/** Все строки списка разом. */
export function rowsForRegion(rows, region) {
  return rows.map((row) => rowForRegion(row, region));
}

export function regionSwitch(active) {
  const now = active || WORLD;
  return html`
    <div class="regions" role="group" aria-label="Регион">
      <span class="regions__label">Регион</span>
      ${raw(
        REGIONS.map(
          (region) => html`
            <button
              type="button"
              class="regions__pill"
              data-region="${region.value}"
              aria-pressed="${region.value === now}"
            >
              ${region.label}
            </button>
          `,
        ).join(""),
      )}
    </div>
  `;
}

export function bindRegionSwitch(root, onPick) {
  root.querySelectorAll("[data-region]").forEach((button) => {
    button.addEventListener("click", () => onPick(button.dataset.region));
  });
}
