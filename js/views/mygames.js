// Мои игры: как живёт то, что уже сделано (см. trendhunter/mygames.py).
//
// Раздел показывает публичные показатели листинга — рейтинг, оценки,
// установки — и их движение между проверками. Закрытых цифр консоли здесь
// нет и не будет: в консоль ведёт ссылка, а подмешивать её данные к
// магазинным значило бы смешать два источника с разными правилами.

import { addMyGame, getMyGames, isReadOnly, refreshMyGames, removeMyGame } from "../api.js";
import { html, raw, dateLabel, plural } from "../format.js";
import { gtrendsUrl } from "../components/checklinks.js";
import { skeleton, skelCards } from "../components/skeleton.js";

const CONSOLE_URL = "https://play.google.com/console";

// Числа установок и оценок большие — без разрядов не читаются.
const NUM = new Intl.NumberFormat("ru-RU");

export async function myGamesView(mount) {
  mount.insertAdjacentHTML(
    "beforeend",
    html`
      <header class="view-head">
        <div>
          <p class="eyebrow">Свои приложения</p>
          <h1 class="view-title">Мои игры</h1>
        </div>
        <div class="find__meta">
          <a class="checklink" href="${CONSOLE_URL}" target="_blank" rel="noreferrer"
            >Play Console&nbsp;↗</a
          >
          ${raw(
            isReadOnly()
              ? ""
              : html`<button class="cta cta--ghost" type="button" id="games-refresh">
                  Обновить данные
                </button>`,
          )}
        </div>
      </header>
      <p class="runline">
        Публичные числа листинга Google Play: рейтинг, оценки, установки.
        Каждая проверка дописывает срез — по срезам видно движение.
      </p>
      ${raw(
        isReadOnly()
          ? ""
          : html`<form class="addtrend" id="add-game">
              <label class="addtrend__field">
                <span class="controls__label">Добавить игру</span>
                <input
                  type="text"
                  name="app"
                  placeholder="ссылка на игру в Google Play или id пакета"
                  autocomplete="off"
                />
              </label>
              <label class="addtrend__field">
                <span class="controls__label">Заметка</span>
                <input
                  type="text"
                  name="note"
                  placeholder="необязательно"
                  autocomplete="off"
                />
              </label>
              <button type="submit">Добавить</button>
              <p class="addtrend__status" role="status"></p>
            </form>`,
      )}
      <div class="section" id="games" aria-busy="true">
        <p class="sr-only" role="status">Загружаю…</p>
        ${raw(skeleton(skelCards(2)))}
      </div>
    `,
  );

  const target = mount.querySelector("#games");
  let payload;
  try {
    payload = await getMyGames();
  } catch (error) {
    target.removeAttribute("aria-busy");
    target.innerHTML = html`<div class="alert">${error.message}</div>`;
    return;
  }
  target.removeAttribute("aria-busy");
  render(target, payload);
  if (!isReadOnly()) {
    bindAdd(mount, target);
    bindRefresh(mount, target);
  }
}

function bindAdd(mount, target) {
  const form = mount.querySelector("#add-game");
  const status = form.querySelector(".addtrend__status");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const app = form.elements.app.value.trim();
    if (!app) {
      status.textContent = "Нужна ссылка на игру или id пакета.";
      return;
    }
    const button = form.querySelector("button");
    button.disabled = true;
    status.textContent = "Спрашиваю магазин…";
    try {
      const payload = await addMyGame(app, form.elements.note.value.trim());
      render(target, payload);
      status.textContent = "Готово.";
      form.reset();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

function bindRefresh(mount, target) {
  const button = mount.querySelector("#games-refresh");
  button.addEventListener("click", async () => {
    button.disabled = true;
    const label = button.textContent;
    button.textContent = "Спрашиваю магазин…";
    try {
      const payload = await refreshMyGames();
      render(target, payload);
      if (payload.failed?.length) {
        target.insertAdjacentHTML(
          "afterbegin",
          html`<div class="alert">
            Магазин не ответил: ${payload.failed.join(", ")} — их срезы остались
            прежними.
          </div>`,
        );
      }
    } catch (error) {
      target.insertAdjacentHTML(
        "afterbegin",
        html`<div class="alert">${error.message}</div>`,
      );
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  });
}

function render(target, payload) {
  const games = payload.games || [];
  if (!games.length) {
    target.innerHTML = html`
      <div class="empty">
        <b>Пока ни одной игры</b>
        <p>
          ${isReadOnly()
            ? "Игры добавляются в дашборде на ПК — здесь они читаются вместе с историей проверок."
            : "Вставь в форму выше ссылку на страницу своей игры в Google Play — числа подтянутся сразу, история начнёт копиться с этой проверки."}
        </p>
      </div>
    `;
    return;
  }
  target.innerHTML = html`
    <ul class="finds">
      ${raw(games.map((game) => gameCard(game, payload.countries || [])).join(""))}
    </ul>
  `;
  bindRemove(target);
}

function bindRemove(target) {
  target.querySelectorAll("[data-remove]").forEach((button) =>
    button.addEventListener("click", async () => {
      if (!window.confirm("Убрать игру вместе с накопленной историей?")) return;
      button.disabled = true;
      try {
        const payload = await removeMyGame(button.dataset.remove);
        render(target, payload);
      } catch (error) {
        button.disabled = false;
        target.insertAdjacentHTML(
          "afterbegin",
          html`<div class="alert">${error.message}</div>`,
        );
      }
    }),
  );
}

function gameCard(game, countries) {
  const last = game.last;
  return html`
    <li class="find game">
      ${raw(
        game.icon
          ? html`<img class="game__icon" src="${game.icon}" alt="" loading="lazy" />`
          : "",
      )}
      <div class="game__body">
        <b class="find__name">${game.title}</b>
        <div class="find__meta">
          ${raw(game.developer ? html`<span class="tag">${game.developer}</span>` : "")}
          ${raw(last?.version ? html`<span class="tag">v${last.version}</span>` : "")}
          ${raw(updatedTag(last))}
          ${raw(snapshotTag(game))}
        </div>
        ${raw(numbers(game, countries))}
        ${raw(deltas(game, countries))}
        ${raw(game.note ? html`<p class="find__about">${game.note}</p>` : "")}
        <div class="find__meta">
          <a
            class="checklink"
            href="https://play.google.com/store/apps/details?id=${encodeURIComponent(game.app_id)}"
            target="_blank"
            rel="noreferrer"
            >Листинг&nbsp;↗</a
          >
          <a
            class="checklink"
            href="${gtrendsUrl(game.title)}"
            target="_blank"
            rel="noreferrer"
            >Google Trends&nbsp;↗</a
          >
          <a class="checklink" href="${CONSOLE_URL}" target="_blank" rel="noreferrer"
            >Play Console&nbsp;↗</a
          >
          ${raw(
            isReadOnly()
              ? ""
              : html`<button
                  class="checklink game__remove"
                  type="button"
                  data-remove="${game.app_id}"
                >
                  Убрать
                </button>`,
          )}
        </div>
        ${raw(historyTable(game, countries))}
      </div>
    </li>
  `;
}

function updatedTag(last) {
  if (!last?.updated) return "";
  const iso = new Date(last.updated * 1000).toISOString();
  return html`<span class="tag">обновлена ${dateLabel(iso)}</span>`;
}

function snapshotTag(game) {
  if (!game.last) return '<span class="tag tag--warn">ещё не проверялась</span>';
  const word = plural(game.snapshots, "проверка", "проверки", "проверок");
  return html`<span class="tag"
    >${game.snapshots} ${word}, последняя ${dateLabel(game.last.ts)}</span
  >`;
}

/** Текущие числа: установки общие, рейтинг — по каждому стору наблюдения. */
function numbers(game, countries) {
  const last = game.last;
  if (!last) return "";
  const cells = [];
  if (last.real_installs) {
    cells.push(metric("Установки", NUM.format(last.real_installs)));
  } else if (last.installs) {
    cells.push(metric("Установки", last.installs));
  }
  for (const country of countries) {
    const slice = last.by_country?.[country];
    if (!slice || slice.score === null || slice.score === undefined) continue;
    const ratings = slice.ratings ? ` · ${NUM.format(slice.ratings)}` : "";
    cells.push(metric(`★ ${country.toUpperCase()}`, `${slice.score.toFixed(2)}${ratings}`));
  }
  if (!cells.length) return "";
  return html`<div class="scorebar">${raw(cells.join(""))}</div>`;
}

function metric(label, value) {
  return html`
    <div class="metric">
      <span class="metric__label">${label}</span>
      <span class="metric__value">${value}</span>
    </div>
  `;
}

/**
 * Движение с прошлой проверки. Ноль не показывается: «+0» — это шум,
 * а отсутствие строки честно значит «не изменилось».
 */
function deltas(game, countries) {
  const { last, previous } = game;
  if (!last || !previous) return "";
  const rows = [];
  if (last.real_installs && previous.real_installs) {
    const diff = last.real_installs - previous.real_installs;
    if (diff) rows.push(`${diff > 0 ? "+" : "−"}${NUM.format(Math.abs(diff))} установок`);
  }
  for (const country of countries) {
    const now = last.by_country?.[country]?.score;
    const was = previous.by_country?.[country]?.score;
    if (typeof now !== "number" || typeof was !== "number") continue;
    const diff = Math.round((now - was) * 100) / 100;
    if (diff) {
      rows.push(`★ ${country.toUpperCase()} ${diff > 0 ? "+" : "−"}${Math.abs(diff)}`);
    }
  }
  if (!rows.length) return "";
  return html`<p class="game__delta">
    С прошлой проверки: ${rows.join(" · ")}
  </p>`;
}

/** История срезов — та же таблица, что у графика тренда: даты сверху вниз. */
function historyTable(game, countries) {
  const rows = (game.history || []).slice().reverse();
  if (rows.length < 2) return "";
  const body = rows
    .map(
      (snap) => html`
        <tr>
          <td>${dateLabel(snap.ts)}</td>
          <td>${snap.real_installs ? NUM.format(snap.real_installs) : snap.installs || "—"}</td>
          ${raw(
            countries
              .map((country) => {
                const slice = snap.by_country?.[country];
                return `<td>${slice?.score ? slice.score.toFixed(2) : "—"}</td>`;
              })
              .join(""),
          )}
        </tr>
      `,
    )
    .join("");
  return html`
    <details class="chart__table">
      <summary>История проверок</summary>
      <table>
        <thead>
          <tr>
            <th>Дата</th>
            <th>Установки</th>
            ${raw(countries.map((c) => `<th>★ ${c.toUpperCase()}</th>`).join(""))}
          </tr>
        </thead>
        <tbody>
          ${raw(body)}
        </tbody>
      </table>
    </details>
  `;
}
