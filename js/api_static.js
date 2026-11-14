// Статический API Mini App (2026-08-08): бандл живёт на GitHub Pages без
// сервера, GET-функции читают пререндеренные JSON. Интерфейс обязан
// СОВПАДАТЬ с api.js — экспорт в экспорт: сборка подменяет файл, и любой
// новый вызов во вьюхах должен упасть тестом tests/js/api_static.test.js,
// а не молча в проде.
//
// Пути относительные намеренно: Pages живёт в подпути /trend-hunter-app/,
// и абсолютный /api/… указывал бы мимо сайта.
//
// Действия записи в статике невозможны. Отказ честный (конституция II):
// никакого «ок» без сохранения.

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const READ_ONLY =
  "Приложение только для чтения — оценки и действия доступны в дашборде на ПК.";

async function readJson(path) {
  let response;
  try {
    response = await fetch(path);
  } catch (cause) {
    throw new ApiError("Данные не загрузились. Проверь связь и обнови страницу.", 0);
  }
  if (!response.ok) {
    throw new ApiError(`Данные не найдены: ${path}`, response.status);
  }
  return response.json();
}

function readOnly() {
  return Promise.reject(new ApiError(READ_ONLY, 405));
}

// Сортировку и фильтр список делает сам (applySort в trends.js) — один файл
// отвечает на любой запрос списка, параметры игнорируются честно.
export function getTrends() {
  return readJson("api/trends.json");
}

export function getTrend(slug) {
  return readJson(`api/trend/${encodeURIComponent(slug)}.json`);
}

export function getCandidates() {
  return readJson("api/candidates.json");
}

// Архив обнаружений по дням в бандл не пререндерится: вьюхи его не зовут.
// Если однажды позовут — придёт честный 404, а не пустой успех.
export function getEntities(day) {
  return readJson(`api/entities/${encodeURIComponent(day)}.json`);
}

export function promoteCandidate(slug) {
  return readOnly();
}

export function getAnalytics() {
  return readJson("api/analytics.json");
}

export function getNotifications() {
  return readJson("api/notifications.json");
}

export function getWorkspace() {
  return readJson("api/workspace.json");
}

export function getAiChart() {
  return readJson("api/aichart.json");
}

export function rebuildAiChart() {
  return readOnly();
}

export function getDeck() {
  return readJson("api/deck.json");
}

export function generateIdeas(slug) {
  return readOnly();
}

export function rate(target, verdict) {
  return readOnly();
}

export function addManualTrend(title, note = "") {
  return readOnly();
}

export function getMyGames() {
  return readJson("api/mygames.json");
}

export function addMyGame(app, note = "") {
  return readOnly();
}

export function refreshMyGames() {
  return readOnly();
}

export function removeMyGame(appId) {
  return readOnly();
}

export function saveNote(target, note) {
  return readOnly();
}

/** Бандл без сервера: вьюхи не рисуют формы записи вовсе — честнее,
 * чем форма, чей единственный исход 405. */
export function isReadOnly() {
  return true;
}
