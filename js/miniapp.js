// Слой Mini App (2026-08-08): интеграция с Telegram WebApp и телефонная
// навигация. Скрипт живёт только в бандле — в десктопный index.html его не
// врезают, поэтому window.Telegram здесь бывает не всегда (открыли ссылку
// в браузере), и все вызовы SDK — под опциональной цепочкой.
//
// Верхняя навигация на телефоне вне досягаемости большого пальца, поэтому
// в бандле её заменяет нижний таб-бар (miniapp.css прячет .nav). Четыре
// главных раздела + лист «Ещё» с остальными. Состав ссылок обязан совпадать
// с <nav> из index.html — дрейф стережёт tests/js/miniapp.test.js.

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  // На весь экран сразу: полусвёрнутое окно обрезает список трендов.
  tg.expand();
  // Прокрутка списков не должна сворачивать приложение (Bot API 7.7+).
  tg.disableVerticalSwipes?.();
}

const TABS = [
  { href: "#/", label: "Обзор" },
  { href: "#/trends", label: "Тренды" },
  { href: "#/candidates", label: "Кандидаты" },
  { href: "#/ai", label: "AI-чарт" },
];

const MORE = [
  { href: "#/deck", label: "Разбор" },
  { href: "#/mygames", label: "Мои игры" },
  { href: "#/analytics", label: "Аналитика" },
  { href: "#/workspace", label: "Сохранённое" },
  { href: "#/notifications", label: "Журнал" },
];

// `#/trend/<слаг>` относится к списку трендов, `#/` совпадает только целиком:
// как префикс он совпал бы с ЛЮБЫМ адресом, и «Обзор» горел бы всегда.
function activeHref(hash) {
  if (!hash || hash === "#/" || hash === "#") return "#/";
  if (hash.startsWith("#/trend/") || hash.startsWith("#/trends")) return "#/trends";
  const all = [...TABS, ...MORE];
  const hit = all.find((tab) => tab.href !== "#/" && hash.startsWith(tab.href));
  return hit ? hit.href : "#/";
}

function makeLink(tab) {
  const a = document.createElement("a");
  a.href = tab.href;
  a.textContent = tab.label;
  return a;
}

const sheet = document.createElement("div");
sheet.className = "tabsheet";
sheet.hidden = true;
MORE.forEach((tab) => sheet.append(makeLink(tab)));

const bar = document.createElement("nav");
bar.className = "tabbar";
bar.setAttribute("aria-label", "Разделы");
TABS.forEach((tab) => bar.append(makeLink(tab)));

const moreButton = document.createElement("button");
moreButton.type = "button";
moreButton.className = "tabbar__more";
moreButton.textContent = "Ещё";
moreButton.setAttribute("aria-expanded", "false");
moreButton.addEventListener("click", () => {
  sheet.hidden = !sheet.hidden;
  moreButton.setAttribute("aria-expanded", String(!sheet.hidden));
});
bar.append(moreButton);

document.body.append(sheet, bar);

function sync() {
  const current = activeHref(location.hash);
  for (const link of [...bar.querySelectorAll("a"), ...sheet.querySelectorAll("a")]) {
    link.classList.toggle("is-active", link.getAttribute("href") === current);
  }
  const inMore = MORE.some((tab) => tab.href === current);
  moreButton.classList.toggle("is-active", inMore);

  // Со страницы тренда в Telegram выводит системная «Назад» — это привычнее
  // и ближе, чем искать стрелку в разметке.
  if (tg?.BackButton) {
    if (location.hash.startsWith("#/trend/")) {
      tg.BackButton.show();
    } else {
      tg.BackButton.hide();
    }
  }
}

tg?.BackButton?.onClick(() => history.back());

window.addEventListener("hashchange", () => {
  sheet.hidden = true;
  moreButton.setAttribute("aria-expanded", "false");
  sync();
});
sync();

// Шапка read-only приложения обязана отвечать на главный вопрос читателя:
// «данные свежие?» — и на второй сразу за ним: «а когда будут свежее?»
// (2026-08-09). Чип со временем последнего прогона и следующим — в местном
// времени телефона. Файл тот же, что грузит список, — браузер отдаст из кеша.
(async () => {
  try {
    const { nextRunTimeLabel } = await import("./components/schedule.js");
    const payload = await (await fetch("api/trends.json")).json();
    const stamp = payload?.run?.finished_at;
    if (!stamp) return;
    const when = new Date(stamp);
    if (Number.isNaN(when.getTime())) return;
    const day = when.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
    const time = when.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    const next = nextRunTimeLabel(payload?.run?.schedule);
    const chip = document.createElement("span");
    chip.className = "topbar__data";
    chip.textContent = `данные ${day} · ${time}` + (next ? ` · след. ${next}` : "");
    document.querySelector(".topbar__row")?.append(chip);
  } catch {
    // Чип — украшение со смыслом, а не обещание: не вышло — шапка без него.
  }
})();
