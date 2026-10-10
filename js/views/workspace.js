// Личное пространство: сохранённое и заметки (FR-036).
//
// Заметка сохраняется по уходу фокуса, без кнопки «сохранить»: она нужна
// в тот момент, когда мысль появилась, а не когда до кнопки дошли руки.

import { getWorkspace, isReadOnly, saveNote } from "../api.js";
import { html, raw, timeLabel } from "../format.js";
import { stagger } from "../motion.js";
import { skeleton, skelCards } from "../components/skeleton.js";

const VERDICTS = { like: "❤️ сохранено", favorite: "⭐ избранное" };

export async function workspaceView(mount) {
  mount.insertAdjacentHTML(
    "beforeend",
    html`
      <header class="view-head">
        <div>
          <p class="eyebrow">Личное</p>
          <h1 class="view-title">Сохранённое</h1>
        </div>
      </header>
      <div id="workspace">
        <p class="sr-only" role="status">Загружаю…</p>
        ${raw(skeleton(skelCards(3)))}
      </div>
    `,
  );

  const target = mount.querySelector("#workspace");
  try {
    const payload = await getWorkspace();
    target.innerHTML = payload.saved.length
      ? html`<ul class="saved rise-list">${raw(payload.saved.map(card).join(""))}</ul>` +
        orphans(payload.notes)
      : empty() + orphans(payload.notes);
    if (payload.saved.length) stagger(target.querySelector(".rise-list"));
    if (!isReadOnly()) bindNotes(target);
  } catch (error) {
    target.innerHTML = html`<div class="alert">${error.message}</div>`;
  }
}

function card(row) {
  const link =
    row.kind === "trend"
      ? `#/trend/${encodeURIComponent(row.target)}`
      : row.trend_slug
        ? `#/trend/${encodeURIComponent(row.trend_slug)}`
        : "";
  return html`
    <li class="panel saved__item">
      <div class="saved__head">
        <div>
          <p class="eyebrow">${row.kind === "trend" ? "тренд" : "идея"} · ${VERDICTS[row.verdict] || row.verdict}</p>
          ${raw(
            link
              ? html`<a class="idea__title" href="${link}">${row.title}</a>`
              : html`<span class="idea__title">${row.title}</span>`,
          )}
        </div>
        ${raw(
          row.opportunity === null || row.opportunity === undefined
            ? ""
            : html`<span class="tag">Opportunity ${row.opportunity}</span>`,
        )}
      </div>
      <label class="note-field">
        <span class="metric__label">Заметка</span>
        <textarea
          data-target="${row.target}"
          rows="2"
          placeholder="${isReadOnly() ? "Заметки пишутся на ПК" : "Что решил и почему"}"
          ${raw(isReadOnly() ? "readonly" : "")}
        >
${row.note || ""}</textarea
        >
      </label>
      <p class="runline">${timeLabel(row.ts)}</p>
    </li>
  `;
}

function orphans(notes) {
  if (!notes || !notes.length) return "";
  return html`
    <section class="section">
      <div class="section__head"><h2 class="eyebrow">Заметки без оценки</h2></div>
      <ul class="saved">
        ${raw(
          notes
            .map(
              (note) => html`<li class="panel">
                <p class="eyebrow">${note.target}</p>
                <p>${note.note}</p>
              </li>`,
            )
            .join(""),
        )}
      </ul>
    </section>
  `;
}

function empty() {
  return html`
    <div class="empty">
      <b>Пока пусто</b>
      <p>
        Оцени тренды в <a href="#/deck">быстром разборе</a> — сохранённые
        и избранные появятся здесь вместе с заметками.
      </p>
    </div>
  `;
}

function bindNotes(target) {
  target.querySelectorAll("textarea[data-target]").forEach((field) => {
    const initial = field.value.trim();
    field.addEventListener("blur", async () => {
      const value = field.value.trim();
      if (value === initial) return;
      try {
        await saveNote(field.dataset.target, value);
        field.classList.add("note-field--saved");
      } catch (error) {
        field.insertAdjacentHTML(
          "afterend",
          html`<span class="note note--error">${error.message}</span>`,
        );
      }
    });
  });
}
