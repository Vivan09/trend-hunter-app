// Фильтр по источнику для длинных списков (просьба пользователя 2026-08-09:
// «выбрать чат Twitch и смотреть всё, что добавилось оттуда»).
//
// Варианты собираются из данных, а не хардкодятся, — по той же причине, что
// у regionfilter: набор источников растёт (twitch_chat появился 2026-08-08),
// и зашитый список молча не показывал бы новые. Именно так фильтр кандидатов
// прожил сутки без чата Twitch, хотя кандидаты из него уже приезжали.
//
// Совпадение — по принадлежности: тренд, замеченный и в чате Twitch, и на
// YouTube, находится обоими пунктами. Счёт в подписи — сколько строк списка
// источник видел, по нему сразу понятно, что принёс каждый сборщик.

const ANY = { value: "all", label: "любой" };

// Человеческие имена известных источников. Незнакомое имя показывается как
// есть: новый сборщик обязан появиться в фильтре сам, без правки этого файла.
const LABELS = {
  tiktok: "TikTok",
  youtube: "YouTube",
  reddit: "Reddit",
  kym: "Know Your Meme",
  gtrends_daily: "Google Trends",
  roblox: "Roblox",
  twitch: "Twitch",
  twitch_chat: "чат Twitch",
  instagram: "Instagram",
  x: "X",
};

export function sourceFilter(rows) {
  const counts = new Map();
  for (const row of rows) {
    for (const name of row.sources || []) {
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  const ordered = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  return {
    key: "source",
    label: "Источник",
    options: [
      ANY,
      ...ordered.map(([name, count]) => ({
        value: name,
        label: `${LABELS[name] || name} · ${count}`,
      })),
    ],
    match: (row, value) => (row.sources || []).includes(value),
  };
}
