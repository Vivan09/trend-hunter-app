// Заглушки на время загрузки.
//
// Форма повторяет то, что придёт: по заглушке видно, список это или плитки,
// ещё до ответа API. Собираются из одного примитива .skel — семь разных
// скелетонов на семь разделов писать не нужно.
//
// Разметка помечена aria-hidden: для скринридера рядом остаётся текстовый
// статус, который ставит сам раздел. Заглушка без статуса была бы регрессом —
// сейчас «Загружаю…» это настоящий текст.

import { html, raw } from "../format.js";

function repeat(n, chunk) {
  return Array.from({ length: n }, () => chunk).join("");
}

/** Обёртка вокруг любого набора заглушек. */
export function skeleton(...parts) {
  return html`<div class="skel-group" aria-hidden="true">${raw(parts.join(""))}</div>`;
}

/** Плитки сводки: переиспользуем .tiles и .tile — форма получается бесплатно. */
export function skelTiles(n) {
  return `<div class="tiles">${repeat(
    n,
    '<div class="tile"><div class="skel skel--value"></div><div class="skel skel--label"></div></div>',
  )}</div>`;
}

/** Карточки-находки вместе с местом под наклейку. */
export function skelCards(n) {
  return `<ul class="finds">${repeat(
    n,
    '<li class="find"><div><div class="skel skel--title"></div>' +
      '<div class="skel skel--meta"></div><div class="skel skel--bar"></div></div>' +
      '<div class="skel skel--sticker"></div></li>',
  )}</ul>`;
}

/** Строки ленты журнала. */
export function skelLines(n) {
  return `<ul class="feed">${repeat(n, '<li><div class="skel skel--line"></div></li>')}</ul>`;
}

/** Сплошной прямоугольник на месте графика. */
export function skelBlock(height) {
  return `<div class="skel skel--block" style="height:${Number(height)}px"></div>`;
}
