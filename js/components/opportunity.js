// Вкладка «Возможности» (Opportunity v2, спека O4): метки строки, переключатель
// пути, счётчик незамеренных и подписи, которые честно говорят, что видно, а что нет.
//
// Здесь только показ. Балл, путь и насыщение приходят от сервера в строке индекса
// (`opportunity_v2`, `opportunity_v2_path`, `opportunity_v2_unsat`), лидер и число
// игр — из `proven_demand_parts`. Ни одной цифры клиент не считает сам.

import {
  NOT_MEASURED,
  STALE_MEASURE_DAYS,
  fixedHalfEven,
  html,
  measureAgeTag,
  raw,
  roundHalfEven,
} from "../format.js";
import { WORLD } from "./regionswitch.js";

/** Величина списка «Возможности»: её рисует наклейка и ею отсортирован список. */
export const OPPORTUNITY_V2 = { key: "opportunity_v2", label: "Возможность" };

/** Вкладка «Ищут в Play, игр нет» (W4а): поле индекса `unmet_demand`, разреженное. */
export const UNMET = { key: "unmet_demand", label: "Ищут в Play" };
export const UNMET_TITLE = "Ищут в Play, игр нет";

/**
 * Метка строки и карточки: «Ищут в Play, игр нет · всплывает с 4 из 15 букв».
 * Нет балла (строка не входит) — пусто; нет замера глубины — подсказки есть, а буквы не названы.
 */
export function unmetLabel(row) {
  if (!known(row.unmet_demand)) return "";
  if (known(row.unmet_found_at) && known(row.unmet_term_len)) {
    return `${UNMET_TITLE} · всплывает с ${row.unmet_found_at} из ${row.unmet_term_len} букв`;
  }
  return `${UNMET_TITLE} · подсказки Play есть`;
}

/** Метка «Ищут в Play, игр нет · всплывает с N из M букв» в строке любого списка и в карточке. */
export function unmetTag(row) {
  const label = unmetLabel(row);
  return label ? html`<span class="tag tag--free">${label}</span>` : "";
}

/** Подпись старого балла везде, где история и графики хранят только его. */
export const OLD_LABEL = "Opportunity (старая формула)";
export const OPPORTUNITY_OLD = { key: "opportunity", label: OLD_LABEL };

export { STALE_MEASURE_DAYS };

export const PATHS = [
  { value: "all", label: "Все" },
  { value: "proven", label: "Спрос доказан" },
  { value: "wave", label: "Волна" },
];

const known = (value) => value !== null && value !== undefined;

/** Есть ли у строки балл: ноль — замер, а не неизвестность. */
export function hasScore(row) {
  return known(row.opportunity_v2);
}

/**
 * Путь строки: "" без балла, "wave", "proven" или "unseen". Правило то же, что у
 * Python `opportunity_v2.path_of`, общие случаи — tests/fixtures/path_cases.json:
 * балл без доказательств (нет лидера, поиска и подсказок) — «unseen», не «proven».
 */
export function pathOf(row) {
  if (!hasScore(row)) return "";
  if (row.opportunity_v2_path === "wave") return "wave";
  const parts = row.proven_demand_parts || {};
  const evidence = known(parts.top) || "search" in parts || "suggest" in parts;
  return evidence ? "proven" : "unseen";
}

/** Метка пути строки списка, по `pathOf`. */
export function pathLabel(row) {
  const path = pathOf(row);
  if (path === "wave") return "Волна: сильных игр ещё нет";
  if (path === "proven") return "Спрос доказан";
  return path === "unseen" ? "Спрос пока не виден" : "";
}

/** Установки → «500K», «1.5M»: зеркало Python `proven.installs_label` без плюса. */
export function installsLabel(n) {
  const number = Math.trunc(Number(n));
  for (const [size, suffix] of [[1e9, "B"], [1e6, "M"], [1e3, "K"]]) {
    if (number >= size) {
      const value = number / size;
      const text = value >= 10 || value === Math.trunc(value)
        ? String(roundHalfEven(value))
        : fixedHalfEven(value, 1);
      return `${text}${suffix}`;
    }
  }
  return String(number);
}

/** «лидер 500K · игр от 10K: 6» или «игр нет». */
export function factsLine(row) {
  const parts = row.proven_demand_parts || {};
  if (!known(parts.top)) return "игр нет";
  return `лидер ${installsLabel(parts.top)} · игр от 10K: ${Number(parts.games) || 0}`;
}

/** «Насыщено: лидер 5M, балл ×0,5», если сработала поправка за лидера. */
export function saturationLabel(row) {
  if (!known(row.opportunity_v2_unsat)) return "";
  const top = row.proven_demand_parts?.top;
  const leader = known(top) ? `лидер ${installsLabel(top)}, ` : "";
  return `Насыщено: ${leader}балл ×0,5`;
}

/**
 * Сработала ли поправка за лидера. Строка индекса несёт `opportunity_v2_unsat`,
 * ответ страницы тренда — готовый `saturated` (спека O2, O4).
 */
export function isSaturated(row) {
  return known(row.opportunity_v2_unsat) || row.saturated === true;
}

/**
 * Что балл v2 говорит о нише: "saturated", "blind" или "open" (спека O4).
 *
 * Цвет наклейки и метки считаются отсюда, а не от старой `niche_free`: та меряет
 * похожие имена в выдаче и на снимке 11-06 звала занятыми 35 из верхних 40 строк,
 * рядом с «Волна: сильных игр ещё нет» и «лидер 5K». Слепой поиск отдельно: лидера
 * не видно, и назвать нишу ненасыщенной значило бы выдать незнание за замер.
 */
export function nicheOf(row) {
  if (isSaturated(row)) return "saturated";
  return row.competitors_hidden ? "blind" : "open";
}

/** Метка ниши там, где нет строки фактов (колода). Без балла о нише не утверждаем ничего. */
export function nicheTagV2(row) {
  if (!hasScore(row)) return '<span class="tag">ниша не проверена</span>';
  const niche = nicheOf(row);
  if (niche === "saturated") return '<span class="tag tag--taken">ниша насыщена</span>';
  if (niche === "blind") return '<span class="tag tag--warn">конкуренты не видны</span>';
  return '<span class="tag tag--free">ниша не насыщена</span>';
}

/** «Замер N дн. назад», только когда замеру больше порога; «не замерен» здесь молчит (Р14). */
export function ageLabel(row, now = Date.now(), warnDays = STALE_MEASURE_DAYS) {
  const tag = measureAgeTag(row, now, warnDays);
  return tag === NOT_MEASURED ? "" : tag;
}

/**
 * Метки строки списка. Строка без балла не получает ни пути, ни фактов:
 * говорить о лидере там, где рынок не замерен, значило бы выдумать.
 */
export function opportunityTags(row, now = Date.now()) {
  if (!hasScore(row)) return "";
  const warn = (text) => (text ? html`<span class="tag tag--warn">${text}</span>` : "");
  const plain = (text) => (text ? html`<span class="tag">${text}</span>` : "");
  return (
    plain(pathLabel(row)) +
    plain(factsLine(row)) +
    warn(saturationLabel(row))
  );
}

/**
 * Фильтр по пути. При поиске он не действует: найденное имя не должно
 * исчезать молча из-за переключателя, о котором человек забыл.
 */
export function filterByPath(rows, path, query = "") {
  if (!path || path === "all" || (query || "").trim()) return rows;
  return rows.filter((row) => pathOf(row) === path);
}

/** Активные строки без балла: они стоят в очереди замера. */
export function unmeasuredCount(rows) {
  return rows.filter((row) => row.active !== false && !hasScore(row)).length;
}

export function unmeasuredNote(count) {
  return count ? `Ещё не замерены в Play: ${count}. Балла нет, они стоят в очереди.` : "";
}

/** Подпись при выбранном регионе: балл и порядок остаются мировыми. */
export function regionNote(region) {
  return region && region !== WORLD
    ? "Балл считается по миру: по регионам новая формула ещё не проверялась."
    : "";
}

/**
 * Переключатель «Все · Спрос доказан · Волна». Заметка очереди стоит прямо под
 * ним: страниц больше ста, до низа списка никто не доходит.
 */
export function pathSwitch(active, searching = false, unmeasured = 0) {
  return html`
    <div class="regions" role="group" aria-label="Путь к баллу">
      <span class="regions__label">Путь</span>
      ${raw(
        PATHS.map(
          (path) => html`
            <button
              type="button"
              class="regions__pill"
              data-path="${path.value}"
              aria-pressed="${path.value === active}"
            >
              ${path.label}
            </button>
          `,
        ).join(""),
      )}
    </div>
    ${raw(
      searching && active !== "all"
        ? html`<p class="runline">При поиске переключатель не действует: показаны все найденные имена.</p>`
        : "",
    )}
    ${raw(unmeasuredNote(unmeasured) ? html`<p class="guess">${unmeasuredNote(unmeasured)}</p>` : "")}
  `;
}
