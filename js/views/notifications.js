// Журнал прогонов (FR-025).
//
// Список отвечает на вопрос «система вообще работала?». Неполный прогон
// помечается явно: молчание о деградации хуже, чем её отсутствие.

import { getNotifications } from "../api.js";
import { html, raw, timeLabel } from "../format.js";
import { stagger } from "../motion.js";
import { skeleton, skelLines } from "../components/skeleton.js";

const KINDS = { digest: "прогон", alert: "внимание", info: "событие" };

export async function notificationsView(mount) {
  mount.insertAdjacentHTML(
    "beforeend",
    html`
      <header class="view-head">
        <div>
          <p class="eyebrow">Журнал</p>
          <h1 class="view-title">События</h1>
        </div>
      </header>
      <div id="events">
        <p class="sr-only" role="status">Загружаю…</p>
        ${raw(skeleton(skelLines(8)))}
      </div>
    `,
  );

  const target = mount.querySelector("#events");
  try {
    const payload = await getNotifications();
    target.innerHTML = payload.items.length
      ? html`<ul class="feed rise-list">${raw(payload.items.map(row).join(""))}</ul>`
      : html`<div class="empty">
          <b>Событий нет</b>
          <p>Журнал заполняется после первого прогона пайплайна.</p>
        </div>`;
    if (payload.items.length) stagger(target.querySelector(".rise-list"));
  } catch (error) {
    target.innerHTML = html`<div class="alert">${error.message}</div>`;
  }
}

function row(item) {
  return html`
    <li>
      <time datetime="${item.ts}">${timeLabel(item.ts)}</time>
      <div>
        <span class="tag ${raw(item.kind === "alert" ? "tag--warn" : "")}"
          >${KINDS[item.kind] || item.kind}</span
        >
        <p>${item.title}</p>
        ${raw(item.summary ? html`<p class="note">${item.summary}</p>` : "")}
      </div>
    </li>
  `;
}
