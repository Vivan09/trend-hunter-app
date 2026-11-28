// Расписание автопрогонов (2026-08-09).
//
// Часы приезжают с данными — run.schedule.utc_hours из trends.json (конфиг →
// run_summary), фронт config.yaml не читает; синхронность конфига с cron
// воркфлоу стережёт tests/unit/test_schedule_sync.py на стороне Python.
//
// UTC в местное время зрителя переводит браузер сам — потому здесь нет ни
// поясов, ни подписей «МСК» (они только у Telegram, которому пояс неоткуда
// взять). «≈» честное: GitHub задерживает cron на минуты и часы. Ручные
// прогоны в расчёте не участвуют — они непредсказуемы.
//
// Минута (P0-D, 2026-11-04): крон стоит на :37 — на ровном часе очереди
// GitHub задерживали плановые прогоны на 3–10 часов. Минута приезжает в
// run.schedule.utc_minute; нет её — 0, как было.

/** Ближайший автопрогон СТРОГО после `now`; пустое расписание — null. */
export function nextRunAfter(utcHours, now = new Date(), minute = 0) {
  if (!Array.isArray(utcHours) || !utcHours.length) return null;
  const candidates = [];
  for (const dayShift of [0, 1]) {
    for (const hour of utcHours) {
      candidates.push(
        new Date(
          Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() + dayShift,
            hour,
            minute,
          ),
        ),
      );
    }
  }
  return candidates.filter((moment) => moment > now).sort((a, b) => a - b)[0] || null;
}

/** «через 3 ч» / «через 40 мин» / «вот-вот». Округление честное, не пол. */
export function untilLabel(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "вот-вот";
  if (minutes < 60) return `через ${minutes} мин`;
  return `через ${Math.round(minutes / 60)} ч`;
}

/** Порог сторожа (D8, 2026-11-05): при двух прогонах в день норма ≤ 14 ч. */
export const STALE_AFTER_HOURS = 16;

/** Сколько целых часов назад закончился прогон; мусор и пусто — null. */
export function staleHours(finishedAt, now = new Date()) {
  if (!finishedAt) return null;
  const when = new Date(finishedAt);
  if (Number.isNaN(when.getTime())) return null;
  return Math.max(0, Math.floor((now - when) / 3600000));
}

const pad = (value) => String(value).padStart(2, "0");

const minuteOf = (schedule) => schedule?.utc_minute ?? 0;

/** «≈22:37» в местном времени зрителя — для тесного чипа Mini App. */
export function nextRunTimeLabel(schedule, now = new Date()) {
  const next = nextRunAfter(schedule?.utc_hours, now, minuteOf(schedule));
  if (!next) return "";
  return `≈${pad(next.getHours())}:${pad(next.getMinutes())}`;
}

/** «следующий ≈22:37 (через 3 ч)» — для строки прогона на Обзоре. */
export function nextRunLine(schedule, now = new Date()) {
  const time = nextRunTimeLabel(schedule, now);
  if (!time) return "";
  const next = nextRunAfter(schedule.utc_hours, now, minuteOf(schedule));
  return `следующий ${time} (${untilLabel(next - now)})`;
}
