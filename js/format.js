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

export function daysSince(iso) {
  if (!iso) return null;
  const started = new Date(iso).getTime();
  if (Number.isNaN(started)) return null;
  return Math.max(0, Math.floor((Date.now() - started) / 86400000));
}

export function plural(count, one, few, many) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
