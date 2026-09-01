// Хеш-роутер: #/, #/trends, #/trend/<slug>, #/deck, #/analytics, #/workspace,
// #/notifications. Разделы подключаются по мере готовности историй.

const routes = [];
let notFound = null;
let current = null;

/** pattern: "/trend/:slug" | "/trends" | "/" */
export function route(pattern, view) {
  routes.push({ parts: pattern.split("/").filter(Boolean), view });
}

export function setNotFound(view) {
  notFound = view;
}

export function navigate(path) {
  window.location.hash = `#${path}`;
}

// Хвост `?region=RU` после пути (фича 005). Нужен, чтобы ссылкой на
// отфильтрованный список можно было поделиться и вернуться к нему.
// Отрезается ДО разбора пути: иначе `trends?region=RU` не совпало бы
// с маршрутом `/trends` и раздел просто не открылся бы.
let currentQuery = new URLSearchParams();

function parse() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, search = ""] = raw.split("?");
  currentQuery = new URLSearchParams(search);
  return path.split("/").filter(Boolean);
}

/** Значение из хвоста адреса. */
export function queryParam(key) {
  return currentQuery.get(key) || "";
}

/**
 * Записывает значение в хвост адреса, не перерисовывая раздел.
 *
 * `replaceState`, а не присваивание `location.hash`: второе вызвало бы
 * `hashchange` и повторную отрисовку поверх той, которую вызывающий уже сделал.
 *
 * `emptyValue` — значение, которое означает «ничего не выбрано» и потому в адрес
 * не пишется. У фильтров это `all`, у поиска — пустая строка: запрос «all»
 * человек может ввести всерьёз, и терять его нельзя.
 */
export function setQueryParam(key, value, emptyValue = "all") {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, search = ""] = raw.split("?");
  const params = new URLSearchParams(search);
  if (value && value !== emptyValue) params.set(key, value);
  else params.delete(key);
  currentQuery = params;
  const text = params.toString();
  window.history.replaceState(null, "", `#${path}${text ? `?${text}` : ""}`);
}

function resolve(parts) {
  for (const candidate of routes) {
    if (candidate.parts.length !== parts.length) continue;
    const params = {};
    const matched = candidate.parts.every((part, i) => {
      if (part.startsWith(":")) {
        params[part.slice(1)] = decodeURIComponent(parts[i]);
        return true;
      }
      return part === parts[i];
    });
    if (matched) return { view: candidate.view, params };
  }
  return notFound ? { view: notFound, params: {} } : null;
}

/**
 * Перезапуск анимации появления.
 *
 * Снять и тут же вернуть класс мало: браузер схлопнет обе операции в один
 * кадр и анимация не стартует. Чтение offsetWidth форсирует reflow между ними.
 */
function reveal(mount) {
  mount.classList.remove("rise");
  void mount.offsetWidth;
  mount.classList.add("rise");
}

export function start(mount) {
  const render = async () => {
    const parts = parse();
    const match = resolve(parts);
    if (!match) return;
    current = match;
    markActive(`#/${parts.join("/")}`);
    mount.replaceChildren();
    reveal(mount);
    await match.view(mount, match.params);
    mount.focus({ preventScroll: true });
  };
  window.addEventListener("hashchange", render);
  render();
}

/** Перерисовать текущий раздел — после оценки или генерации. */
export function refresh(mount) {
  if (!current) return;
  mount.replaceChildren();
  reveal(mount);
  return current.view(mount, current.params);
}

function markActive(hash) {
  // Карточка тренда — часть списка трендов: на #/trend/<слаг> подсвечивается
  // пункт «Тренды» (таб-бар Mini App делает так же, см. miniapp.js).
  let root = hash.split("/")[1] || "";
  if (root === "trend") root = "trends";
  document.querySelectorAll(".nav a").forEach((link) => {
    const target = link.getAttribute("href").split("/")[1] || "";
    if (target === root) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}
