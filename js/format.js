// Форматирование значений и безопасная сборка разметки.

const PHASES = {
  new: "новый",
  rising: "растёт",
  plateau: "плато",
  declining: "угасает",
  // Запись не новая, а рост не измерим: момент нейтральный, и врать словом
  // «плато» или прочерком «данных нет» одинаково нельзя (конституция II).
  unknown: "рост не измерен",
};

const CONTENT_TYPES = {
  character: "персонаж",
  meme: "мем",
  challenge: "челлендж",
  phrase: "фраза",
  event: "событие",
  movie: "кино",
  toy: "игрушка",
  ai: "ИИ",
  other: "другое",
};

export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch],
  );
}

/** Тег-шаблон: значения экранируются, вёрстка вокруг — нет. */
export function html(strings, ...values) {
  return strings.reduce(
    (acc, chunk, i) => acc + chunk + (i < values.length ? stringify(values[i]) : ""),
    "",
  );
}

function stringify(value) {
  if (Array.isArray(value)) return value.join("");
  if (value instanceof Raw) return value.value;
  return escapeHtml(value);
}

class Raw {
  constructor(value) {
    this.value = value;
  }
}

/** Готовая разметка, которую не нужно экранировать. */
export function raw(value) {
  return new Raw(value);
}

/** Балл или прочерк: отсутствие данных не притворяется нулём. */
export function score(value) {
  return value === null || value === undefined ? "—" : String(value);
}

export function phaseLabel(phase) {
  return PHASES[phase] || "—";
}

export function contentTypeLabel(type) {
  return CONTENT_TYPES[type] || CONTENT_TYPES.other;
}

export function dateLabel(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function timeLabel(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysSince(iso, now = Date.now()) {
  if (!iso) return null;
  const started = new Date(iso).getTime();
  if (Number.isNaN(started)) return null;
  return Math.max(0, Math.floor((now - started) / 86400000));
}

/** Замер старше этого числа дней подписывается возрастом. Живой порог приходит в `run.measure_warn_days`. */
export const STALE_MEASURE_DAYS = 14;
export const NOT_MEASURED = "не замерен";

/**
 * Возраст замера магазина словами (Р14): «Замер N дн. назад», когда он старше порога.
 *
 * Свежий замер молчит, а замера нет вовсе: «не замерен». Непонятная дата не падает и не врёт:
 * пусто. Один помощник на все вкладки списка, карточку и оценку; порог один с дайджестом.
 */
export function measureAgeTag(row, now = Date.now(), warnDays = STALE_MEASURE_DAYS) {
  const measured = row?.measured_at;
  if (!measured) return NOT_MEASURED;
  const days = daysSince(measured, now);
  const limit = Number.isFinite(Number(warnDays)) ? Number(warnDays) : STALE_MEASURE_DAYS;
  return days !== null && days > limit ? `Замер ${days} дн. назад` : "";
}

export function plural(count, one, few, many) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/**
 * Округление «как Python»: до чётного на точной ничьей (2026-11-05).
 *
 * Python `round()` и `f"{x:.1f}"` смотрят на точное двоичное значение и
 * ничьи отдают чётному: volume_label(1250) == "1.2K", volume_label(12500) ==
 * "12K". JS `toFixed`/`Math.round` на ничьей идут вверх ("1.3", 13) — одно
 * число в дайджесте и в Mini App читалось бы по-разному. Ничью ищем по
 * точному десятичному разложению double (`toFixed(100)`), а не умножением
 * на 10: так 1.15 (на деле 1.1499…) не принимается за ничью.
 * Только x >= 0 — отрицательных объёмов и процентов здесь нет.
 */
export function fixedHalfEven(x, digits) {
  // toFixed(100) уходит в экспоненту от 1e21, а NaN/Infinity не раскладываются:
  // BigInt бросил бы и уронил отрисовку списка. Такой объём — не замер, а мусор;
  // печатаем как есть, не падая.
  if (!Number.isFinite(x) || x >= 1e21) return String(x);
  const [whole, frac = ""] = x.toFixed(100).split(".");
  const kept = BigInt(whole + frac.slice(0, digits));
  const next = Number(frac[digits] ?? "0");
  const rest = frac.slice(digits + 1);
  const tie = next === 5 && /^0*$/.test(rest);
  const up = next > 5 || (next === 5 && !tie) || (tie && kept % 2n === 1n);
  const text = String(up ? kept + 1n : kept).padStart(digits + 1, "0");
  return digits ? `${text.slice(0, -digits)}.${text.slice(-digits)}` : text;
}

/**
 * Целое «как Python `round`». Экспорт — для объёма «Весь мир» на карточке
 * (`searchvolume.worldVolume`), зеркала `search_volume.volume`.
 */
export function roundHalfEven(x) {
  return Number(fixedHalfEven(x, 0));
}

/** Короткая подпись объёма поиска: 950, 1.2K, 12K, 1.8M — зеркало Python `volume_label`. */
export function volumeLabel(n) {
  // Границы сдвинуты на половину шага округления: 9999 иначе стало бы «10.0K».
  if (n < 1000) return String(n);
  if (n < 9950) return `${fixedHalfEven(n / 1000, 1)}K`;
  if (n < 999500) return `${roundHalfEven(n / 1000)}K`;
  if (n < 9950000) return `${fixedHalfEven(n / 1000000, 1)}M`;
  return `${roundHalfEven(n / 1000000)}M`;
}

/** Подпись роста (log2): ↑×32 от удвоения, ↑41%, ↓50%, ±0% — зеркало Python `growth_label`. */
export function growthLabel(g) {
  if (g >= 1) return `↑×${roundHalfEven(2 ** g)}`;
  if (g > 0) {
    const pct = roundHalfEven((2 ** g - 1) * 100);
    return pct ? `↑${pct}%` : "±0%";
  }
  if (g < 0) {
    const pct = roundHalfEven((1 - 2 ** g) * 100);
    return pct ? `↓${pct}%` : "±0%";
  }
  return "±0%";
}
