// Кнопки внешней проверки: тот же запрос, который человек набирал руками.
//
// Пайплайн уже спрашивает Google Trends и Google Play сам, но его ответ —
// числа, а решение принимает человек, и ему нужен живой график и живая
// выдача магазина. До этих кнопок «Шедевростандофф» проверялся копированием
// имени в две вкладки — по разу на каждую страну.
//
// Ссылки региональные: выбранная страна уходит в `geo` Trends и `gl` стора,
// чтобы кнопка отвечала на тот же вопрос, что и баллы рядом с ней.

import { html, raw } from "../format.js";

// Язык каждого стора повторяет COUNTRY_LANG из trendhunter/verification/
// suggest.py: без `hl` магазин отвечает английской выдачей, и русская ниша
// выглядит пустой. Синхронность стережёт тест контрольного набора.
export const PLAY_LANG = { US: "en", RU: "ru", BR: "pt", ID: "id", GB: "en" };

// Горизонт тот же, что у пайплайна (verification.gtrends.timeframe): кнопка
// обязана показывать тот график, по которому посчитан балл, а не другой.
const TIMEFRAME = "today 3-m";

/** Регион кнопки: двухбуквенный код опорной страны или пусто — весь мир. */
function anchor(region) {
  const code = String(region || "").toUpperCase();
  return PLAY_LANG[code] ? code : "";
}

export function gtrendsUrl(title, region = "") {
  const code = anchor(region);
  const geo = code ? `&geo=${code}` : "";
  return (
    `https://trends.google.com/trends/explore` +
    `?date=${encodeURIComponent(TIMEFRAME)}${geo}&q=${encodeURIComponent(title)}&hl=ru`
  );
}

export function gplayUrl(title, region = "") {
  const code = anchor(region);
  const store = code ? `&gl=${code.toLowerCase()}&hl=${PLAY_LANG[code]}` : "";
  return `https://play.google.com/store/search?q=${encodeURIComponent(title)}&c=apps${store}`;
}

/**
 * Пара ссылок-кнопок. `compact` — однословные подписи для карточек списка
 * и строк таблицы, полные имена там не помещаются в ряд меток.
 */
export function checkLinks(title, region = "", { compact = false } = {}) {
  if (!title) return "";
  const code = anchor(region);
  const suffix = code && !compact ? ` в ${code}` : "";
  return html`
    <span class="checklinks">
      <a
        class="checklink"
        href="${gtrendsUrl(title, region)}"
        target="_blank"
        rel="noreferrer"
        title="Живой график интереса${raw(suffix)} — Google Trends"
        >${compact ? "Trends" : "Google Trends"}&nbsp;↗</a
      >
      <a
        class="checklink"
        href="${gplayUrl(title, region)}"
        target="_blank"
        rel="noreferrer"
        title="Живая выдача магазина${raw(suffix)} — Google Play"
        >${compact ? "Play" : "Google Play"}&nbsp;↗</a
      >
    </span>
  `;
}
