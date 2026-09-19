// Правила совпадения для поиска по спискам (дизайн 2026-08-04, раздел 4).
//
// Здесь нет ни DOM, ни знания о разделах: на входе строки и запрос, на выходе
// совпадения с указанием силы. Так эту часть удаётся проверить тестом —
// а проверять её нужно, потому что ошибка в ней не роняет страницу, а тихо
// показывает не то имя.

/** Разделители, которые не должны мешать совпадению: `the-once-ler` = `once ler`. */
const SEPARATOR = /[\s\-_·–—]/;

const COMBINING = /[̀-ͯ]/g;

/** Сила совпадения. Меньше — выше в выдаче. */
const RANK = { exact: 0, prefix: 1, contains: 2, fuzzy: 3 };

/**
 * Приведение к сравнимому виду: регистр, диакритика, разделители.
 *
 * Возвращает и карту обратно в исходную строку: подсветку рисуют по исходному
 * написанию, а его длина после свёртки уже другая — «Café» это четыре знака,
 * а нормализованное «cafe» указывает на них же только через карту.
 */
function fold(text) {
  const source = String(text ?? "");
  const chars = [];
  const map = [];
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (SEPARATOR.test(char)) {
      if (chars.length && chars[chars.length - 1] !== " ") {
        chars.push(" ");
        map.push(i);
      }
      continue;
    }
    const folded = char.normalize("NFD").replace(COMBINING, "").toLowerCase();
    for (const part of folded) {
      chars.push(part);
      map.push(i);
    }
  }
  while (chars.length && chars[chars.length - 1] === " ") {
    chars.pop();
    map.pop();
  }
  return { text: chars.join(""), map };
}

export function normalize(text) {
  return fold(text).text;
}

/**
 * Расстояние Левенштейна с потолком: считать точное значение незачем, вопрос
 * всегда «уложилось ли в допуск». Выход по разнице длин отсекает большинство
 * пар до первой строки таблицы.
 */
function distanceWithin(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  if (a === b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      best = Math.min(best, current[j]);
    }
    if (best > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length];
}

/** Допуск опечаток: на коротком запросе две ошибки — это уже другое слово. */
function tolerance(query) {
  return query.length < 6 ? 1 : 2;
}

function looksLike(query, name) {
  const limit = tolerance(query);
  if (distanceWithin(query, name, limit) <= limit) return true;
  return name
    .split(" ")
    .some((word) => word && distanceWithin(query, word, limit) <= limit);
}

function match(row, query, field) {
  const { text: name, map } = fold(row[field]);
  if (!name) return null;

  const at = name.indexOf(query);
  if (at !== -1) {
    const kind = name === query ? "exact" : at === 0 ? "prefix" : "contains";
    const start = map[at];
    const stop = map[at + query.length - 1];
    return { row, kind, at: start, len: stop - start + 1 };
  }
  // Подсвечивать в похожем нечего: совпавшего куска не существует, а обвести
  // имя целиком значило бы выдать догадку за попадание.
  if (looksLike(query, name)) return { row, kind: "fuzzy", at: -1, len: 0 };
  return null;
}

/**
 * Совпадения по одному полю, сильные впереди.
 *
 * Похожее подмешивается, только когда точных нет вовсе: пока хоть одно имя
 * содержит запрос, догадкам в выдаче не место.
 */
export function searchRows(rows, query, { field }) {
  const needle = normalize(query);
  if (!needle) {
    return rows.map((row) => ({ row, kind: "none", at: -1, len: 0 }));
  }
  const found = [];
  for (const row of rows) {
    const hit = match(row, needle, field);
    if (hit) found.push(hit);
  }
  const strict = found.filter((hit) => hit.kind !== "fuzzy");
  const kept = strict.length ? strict : found;
  // Сортировка в JS устойчива, поэтому при равной силе сохраняется тот порядок,
  // в котором раздел передал строки, — а он там осмысленный.
  return kept.sort((a, b) => RANK[a.kind] - RANK[b.kind]);
}
