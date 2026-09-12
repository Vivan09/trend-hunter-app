// Расписание автопрогонов (2026-08-09).
//
// Часы приезжают с данными — run.schedule.utc_hours из trends.json (конфиг →
// run_summary), фронт config.yaml не читает; синхронность конфига с cron
// воркфлоу стережёт tests/unit/test_schedule_sync.py на стороне Python.
//
// UTC в местное время зрителя переводит браузер сам — потому здесь нет ни
// поясов, ни подписей «МСК» (они только у Telegram, которому пояс неоткуда
// взять). «≈» честное: GitHub задерживает cron на 3–25 минут. Ручные прогоны
// в расчёте не участвуют — они непредсказуемы.

/** Ближайший автопрогон СТРОГО после `now`; пустое расписание — null. */
export function nextRunAfter(utcHours, now = new Date()) {
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

const pad = (value) => String(value).padStart(2, "0");

/** «≈22:00» в местном времени зрителя — для тесного чипа Mini App. */
export function nextRunTimeLabel(schedule, now = new Date()) {
  const next = nextRunAfter(schedule?.utc_hours, now);
  if (!next) return "";
  return `≈${pad(next.getHours())}:${pad(next.getMinutes())}`;
}

/** «следующий ≈22:00 (через 3 ч)» — для строки прогона на Обзоре. */
export function nextRunLine(schedule, now = new Date()) {
  const time = nextRunTimeLabel(schedule, now);
  if (!time) return "";
  const next = nextRunAfter(schedule.utc_hours, now);
  return `следующий ${time} (${untilLabel(next - now)})`;
}
