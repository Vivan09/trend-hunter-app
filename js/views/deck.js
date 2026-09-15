// Быстрый разбор: две колоды, по одной карточке за раз (FR-026).
//
// Смысл колоды не в скорости, а в том, что решение принимается по одному
// тренду за раз, без сравнения с соседями по списку. Оценки уходят в контекст
// генерации идей, поэтому «пропустить» — тоже ответ, а не отсутствие ответа.

import { getDeck, rate } from "../api.js";
import { html, raw, contentTypeLabel, phaseLabel } from "../format.js";
import { sticker } from "../components/sticker.js";
import { scorebar } from "../components/scorecard.js";
import { skeleton, skelCards } from "../components/skeleton.js";
import { afterAnimation } from "../motion.js";

const ACTIONS = [
  { verdict: "like", label: "❤️ Сохранить" },
  { verdict: "favorite", label: "⭐ В избранное" },
  { verdict: "skip", label: "❌ Пропустить" },
];

/* Направление ухода = смысл вердикта. «Пропустить» уезжает влево, всё
   остальное — вправо. */
const EXIT = { like: "right", favorite: "right", skip: "left", dislike: "left" };

let deckName = "trends";

export async function deckView(mount) {
  mount.insertAdjacentHTML(
    "beforeend",
    html`
      <header class="view-head">
        <div>
          <p class="eyebrow">Быстрый разбор</p>
          <h1 class="view-title">Колода</h1>
        </div>
        <div class="switch" role="group" aria-label="Колода">
          <button type="button" data-deck="trends" aria-pressed="${deckName === "trends"}">
            Тренды
          </button>
          <button type="button" data-deck="ideas" aria-pressed="${deckName === "ideas"}">
            Идеи
          </button>
        </div>
      </header>
      <div id="deck">
        <p class="sr-only" role="status">Загружаю…</p>
        ${raw(skeleton(skelCards(1)))}
      </div>
    `,
  );

  mount.querySelectorAll("[data-deck]").forEach((button) =>
    button.addEventListener("click", () => {
      if (button.dataset.deck === deckName) return;
      deckName = button.dataset.deck;
      mount.replaceChildren();
      deckView(mount);
    }),
  );

  const target = mount.querySelector("#deck");
  try {
    const payload = await getDeck();
    render(target, payload[deckName] || [], 0);
  } catch (error) {
    target.innerHTML = html`<div class="alert">${error.message}</div>`;
  }
}

function render(target, cards, index) {
  if (index >= cards.length) {
    target.innerHTML = html`
      <div class="empty">
        <b>Колода разобрана</b>
        <p>
          Новые карточки появятся после следующего прогона. Оценки уже учтены
          в контексте генерации идей.
        </p>
      </div>
    `;
    return;
  }

  const card = cards[index];
  target.innerHTML = html`
    <div class="deckcard rise">
      ${raw(deckName === "trends" ? trendCard(card) : ideaCard(card))}
      <div class="deckcard__actions">
        ${raw(
          ACTIONS.map(
            (action) => html`<button class="pill" type="button" data-verdict="${action.verdict}">
              ${action.label}
            </button>`,
          ).join(""),
        )}
        ${raw(
          deckName === "trends"
            ? html`<a class="pill pill--ghost" href="#/trend/${encodeURIComponent(card.slug)}"
                >📂 Открыть разбор</a
              >`
            : "",
        )}
      </div>
      <p class="runline">${index + 1} из ${cards.length}</p>
    </div>
  `;

  const targetId = deckName === "trends" ? card.slug : card.id;
  const actions = [...target.querySelectorAll("[data-verdict]")];
  actions.forEach((button) =>
    button.addEventListener("click", async () => {
      const node = target.querySelector(".deckcard");
      const verdict = button.dataset.verdict;
      actions.forEach((other) => {
        other.disabled = true;
      });

      // Анимация стартует по клику, не дожидаясь сети: иначе движение перестаёт
      // быть откликом на нажатие. Ответ и анимация ждутся вместе.
      node.classList.add(`deckcard--out-${EXIT[verdict] || "left"}`);
      const [sent] = await Promise.allSettled([
        rate(targetId, verdict),
        afterAnimation(node),
      ]);

      if (sent.status === "rejected") {
        // Возврат карточки говорит «оценка не засчитана» раньше, чем будет
        // прочитан текст ошибки.
        node.classList.remove("deckcard--out-left", "deckcard--out-right");
        actions.forEach((other) => {
          other.disabled = false;
        });
        target.insertAdjacentHTML(
          "afterbegin",
          html`<div class="alert">${sent.reason.message}</div>`,
        );
        return;
      }

      render(target, cards, index + 1);
    }),
  );
}

function trendCard(row) {
  return html`
    <div class="deckcard__head">
      <div>
        <h2 class="find__name">${row.title}</h2>
        <div class="find__meta">
          <span class="tag">${contentTypeLabel(row.content_type)}</span>
          <span class="tag">${phaseLabel(row.phase)}</span>
          ${raw(
            row.niche_free
              ? '<span class="tag tag--free">ниша свободна</span>'
              : '<span class="tag tag--taken">ниша занята</span>',
          )}
        </div>
      </div>
      ${raw(sticker(row, { large: true }))}
    </div>
    ${raw(scorebar(row, { className: "scorebar scorebar--lg" }))}
  `;
}

function ideaCard(idea) {
  return html`
    <div class="deckcard__head">
      <div>
        <h2 class="find__name">${idea.concept}</h2>
        <div class="find__meta">
          <span class="tag">${idea.genre || "жанр не указан"}</span>
          <span class="tag">${idea.difficulty || "medium"}</span>
          ${raw(
            idea.trend_source
              ? html`<a class="tag" href="#/trend/${encodeURIComponent(idea.trend_source)}"
                  >${idea.trend_source}</a
                >`
              : "",
          )}
        </div>
      </div>
    </div>
    ${raw(idea.why_now ? html`<p class="prose">${idea.why_now}</p>` : "")}
    ${raw(
      (idea.titles_en || []).length
        ? html`<div class="find__meta">
            ${raw((idea.titles_en || []).map((t) => html`<span class="tag">${t}</span>`).join(""))}
          </div>`
        : "",
    )}
  `;
}
