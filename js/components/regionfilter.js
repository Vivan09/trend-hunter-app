// Фильтр по региону для длинных списков (фича 005, FR-025…FR-027).
//
// Варианты собираются из данных, а не хардкодятся: набор регионов меняется
// вместе с источниками, и зашитый список молча перестал бы показывать новые.
//
// Совпадение — по любой из двух географий тренда. Пользователь спрашивает
// «что актуально для RU», и на этот вопрос отвечают оба источника: и поисковый
// интерес, и наши собственные упоминания. Объединение уже посчитано на стороне
// пайплайна и лежит в строке списка полем `regions`.
//
// GLOBAL остаётся отдельным пунктом и не подмешивается к странам: у TikTok он
// почти у всего, и «показать всё для RU» перестало бы что-либо значить.

const ANY = { value: "all", label: "любой" };

export function regionFilter(rows) {
  const counts = new Map();
  for (const row of rows) {
    for (const code of row.regions || []) {
      counts.set(code, (counts.get(code) || 0) + 1);
    }
  }
  const ordered = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  return {
    key: "region",
    label: "Регион",
    options: [
      ANY,
      ...ordered.map(([code, count]) => ({
        value: code,
        label: code === "GLOBAL" ? `без страны · ${count}` : `${code} · ${count}`,
      })),
    ],
    match: (row, value) => (row.regions || []).includes(value),
  };
}
