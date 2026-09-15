// Поле поиска с подсказками (дизайн 2026-08-04, разделы 5 и 6).
//
// Компонент знает о разделе ровно два факта, и оба приходят снаружи: по какому
// полю искать и что делать с выбранной подсказкой. У тренда есть своя страница,
// у кандидата её нет — поэтому «что делать» не может жить здесь.
//
// Разметка поля рисуется вне того контейнера, который раздел перерисовывает на
// каждое изменение списка. Иначе набранный символ уничтожал бы поле вместе
// с фокусом и кареткой.

import { html, raw, escapeHtml } from "../format.js";
import { searchRows } from "../search/match.js";

/** Один символ совпадает с сотней имён — это не подсказка, а шум. */
export const MIN_QUERY = 2;

const MAX_SUGGESTIONS = 8;

export function searchBox({ id, label = "Поиск по имени", placeholder = "", value = "" }) {
  return html`
    <div class="search" data-search="${id}">
      <label class="controls__label" for="${id}-input">${label}</label>
      <div class="search__field">
        <input
          id="${id}-input"
          class="search__input"
          type="text"
          role="combobox"
          aria-expanded="false"
          aria-controls="${id}-list"
          aria-autocomplete="list"
          autocomplete="off"
          spellcheck="false"
          placeholder="${placeholder}"
          value="${value}"
        />
        <button class="search__clear" type="button" aria-label="Очистить поиск" ${raw(
          value ? "" : "hidden",
        )}>
          ×
        </button>
      </div>
      <ul class="search__list" id="${id}-list" role="listbox" aria-label="${label}" hidden></ul>
    </div>
  `;
}

/**
 * @param {object} options
 * @param {() => object[]} options.rows актуальные строки раздела
 * @param {string} options.field поле с именем
 * @param {(query: string) => void} options.onQuery запрос изменился — перерисовать список
 * @param {(row: object) => void} options.onPick выбрана подсказка
 * @param {(row: object) => string} [options.meta] правая метка строки подсказки
 * @param {(query: string, own: number) => {text: string, href?: string}|null} [options.neighbour]
 *        что найдено в соседнем разделе по тому же запросу
 */
export function bindSearchBox(root, { id, rows, field, onQuery, onPick, meta, neighbour }) {
  const box = root.querySelector(`[data-search="${id}"]`);
  if (!box) return null;
  const input = box.querySelector(".search__input");
  const list = box.querySelector(".search__list");
  const clear = box.querySelector(".search__clear");

  let matches = [];
  let active = -1;

  function close() {
    list.hidden = true;
    list.replaceChildren();
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    matches = [];
    active = -1;
  }

  function setActive(index) {
    const options = list.querySelectorAll(".search__option");
    options.forEach((option, i) => {
      const on = i === index;
      option.classList.toggle("is-active", on);
      option.setAttribute("aria-selected", String(on));
      if (on) option.scrollIntoView({ block: "nearest" });
    });
    if (index >= 0) input.setAttribute("aria-activedescendant", `${id}-option-${index}`);
    else input.removeAttribute("aria-activedescendant");
    active = index;
  }

  function option(match, index) {
    const name = String(match.row[field] ?? "");
    const guess = match.kind === "fuzzy" ? html`<em class="search__guess">похоже</em>` : "";
    const label = meta ? meta(match.row) : "";
    return html`
      <li
        class="search__option"
        id="${id}-option-${index}"
        role="option"
        aria-selected="false"
        data-index="${index}"
      >
        <span class="search__name">${raw(highlight(name, match.at, match.len))}</span>
        <span class="search__meta">${raw(guess)}${raw(guess && label ? " · " : "")}${label}</span>
      </li>
    `;
  }

  function suggest() {
    const query = input.value.trim();
    clear.hidden = !query;
    if (query.length < MIN_QUERY) {
      close();
      return;
    }
    const found = searchRows(rows(), query, { field });
    matches = found.slice(0, MAX_SUGGESTIONS);
    const near = neighbour ? neighbour(query, found.length) : null;
    list.innerHTML =
      (matches.length
        ? matches.map(option).join("")
        : html`<li class="search__miss">Ничего не нашлось</li>`) +
      (near ? nearRow(near) : "");
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    setActive(-1);
  }

  input.addEventListener("input", () => {
    onQuery(input.value.trim());
    suggest();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (list.hidden) {
        suggest();
        return;
      }
      if (!matches.length) return;
      const last = matches.length - 1;
      if (event.key === "ArrowDown") setActive(active >= last ? 0 : active + 1);
      else setActive(active <= 0 ? last : active - 1);
      return;
    }
    if (event.key === "Enter") {
      // Enter без выбранной подсказки — не отправка формы, а «покажи всё
      // похожее»: список внизу уже сужен, остаётся убрать выпадашку с дороги.
      event.preventDefault();
      const picked = active >= 0 ? matches[active] : null;
      close();
      if (picked) onPick(picked.row);
      return;
    }
    if (event.key === "Escape") {
      close();
    }
  });

  // Нажатие мышью уводит фокус раньше, чем случится click, и выпадашка успела
  // бы закрыться до выбора.
  list.addEventListener("mousedown", (event) => event.preventDefault());

  list.addEventListener("click", (event) => {
    const target = event.target.closest(".search__option");
    if (!target) return;
    const picked = matches[Number(target.dataset.index)];
    close();
    if (picked) onPick(picked.row);
  });

  clear.addEventListener("click", () => {
    input.value = "";
    clear.hidden = true;
    onQuery("");
    close();
    input.focus();
  });

  box.addEventListener("focusout", (event) => {
    if (!box.contains(event.relatedTarget)) close();
  });

  bindSlash();

  return {
    /** Подставить имя в поле — так кандидаты отвечают на выбор подсказки. */
    setValue: (text) => {
      input.value = text;
      clear.hidden = !text;
    },
    /** Пересобрать подсказки — например, когда строки раздела изменились. */
    refresh: () => {
      if (!list.hidden) suggest();
    },
  };
}

function highlight(name, at, len) {
  if (at < 0 || !len) return escapeHtml(name);
  return (
    escapeHtml(name.slice(0, at)) +
    `<mark>${escapeHtml(name.slice(at, at + len))}</mark>` +
    escapeHtml(name.slice(at + len))
  );
}

function nearRow(near) {
  const text = escapeHtml(near.text);
  return near.href
    ? `<li class="search__near" role="presentation"><a href="${escapeHtml(near.href)}">${text}</a></li>`
    : `<li class="search__near search__near--mute" role="presentation">${text}</li>`;
}

/**
 * Горячая клавиша «/».
 *
 * Обработчик один на страницу и ищет поле заново при каждом нажатии: разделы
 * сменяются, и ссылка на конкретный input давно бы протухла. Перехват молчит,
 * пока человек печатает в другом поле, — иначе форма ручного ввода тренда
 * теряла бы слэш.
 */
let slashBound = false;

function bindSlash() {
  if (slashBound) return;
  slashBound = true;
  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTyping(event.target)) return;
    const field = document.querySelector(".search__input");
    if (!field) return;
    event.preventDefault();
    field.focus();
    field.select();
  });
}

function isTyping(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
