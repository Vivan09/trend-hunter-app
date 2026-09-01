// Исходный материал, из которого собран тренд (FR-013, FR-014).
//
// Отличие от карточки видео: здесь показывается не «что мы собрали про тренд»,
// а «где именно название встретилось» — с фрагментом ровно в том написании,
// в каком его нашли. По нему видно, почему явление вообще попало в базу.
//
// Материал без контекста не прячется: срез мог уехать за окно, и честная
// пометка лучше молчаливой пропажи — иначе список выглядит короче, чем правда.

import { html, raw, escapeHtml, dateLabel } from "../format.js";

const TEXT_SOURCES = {
  subtitles: "субтитры",
  asr: "распознано",
};

export function mentionCard(mention) {
  const expired = mention.context === "expired";
  const textLabel = TEXT_SOURCES[mention.text_source] || "";
  return html`
    <li class="mention${raw(expired ? " mention--expired" : "")}">
      <div class="mention__head">
        <span class="tag">${mention.source || "источник неизвестен"}</span>
        ${raw(mention.region ? html`<span class="tag">${mention.region}</span>` : "")}
        ${raw(
          mention.author
            ? html`<span class="mention__author">@${mention.author.replace(/^@+/, "")}</span>`
            : "",
        )}
        ${raw(
          mention.ts ? html`<span class="mention__date">${dateLabel(mention.ts)}</span>` : "",
        )}
        ${raw(
          mention.views
            ? html`<span class="mention__views">${compact(mention.views)}</span>`
            : "",
        )}
      </div>
      ${raw(
        mention.title
          ? html`<p class="mention__title">${mention.title}</p>`
          : html`<p class="note">Подпись не сохранилась.</p>`,
      )}
      ${raw(hashtags(mention.hashtags))}
      ${raw(
        mention.text
          ? html`<p class="mention__quote">
              ${raw(textLabel ? html`<span class="tag">${textLabel}</span>` : "")}
              ${mention.text}
            </p>`
          : "",
      )}
      <p class="mention__foot">
        ${raw(mention.raw ? html`<span class="mention__raw">«${mention.raw}»</span>` : "")}
        ${raw(
          mention.url
            ? html`<a href="${mention.url}" target="_blank" rel="noreferrer">оригинал ↗</a>`
            : "",
        )}
        ${raw(
          expired
            ? '<span class="tag tag--warn">срез за окном — контекст не подтянут</span>'
            : "",
        )}
      </p>
    </li>
  `;
}

export function mentionList(mentions, limit = 20) {
  if (!mentions || !mentions.length) {
    return html`<p class="note">
      Исходные материалы появятся после следующего прогона: тренд собран до того,
      как система начала сохранять ссылки на элементы.
    </p>`;
  }
  const sorted = [...mentions].sort((a, b) => String(b.ts || "").localeCompare(String(a.ts || "")));
  const shown = sorted.slice(0, limit);
  const rest = sorted.length - shown.length;
  return html`
    <ul class="mentions">
      ${raw(shown.map(mentionCard).join(""))}
    </ul>
    ${raw(
      rest > 0
        ? html`<p class="note">
            Ещё ${rest}: полный список лежит в архиве обнаружений.
          </p>`
        : "",
    )}
  `;
}

/**
 * Хештеги TikTok и теги YouTube — разные звери. У TikTok это одно слово,
 * у YouTube — фраза («Spider-Man Brand New Day Box Office»). Решётка перед
 * фразой врёт: такого хештега не существует, и найти по нему ничего нельзя.
 * Поэтому решётка ставится только односложным.
 */
function hashtags(tags) {
  if (!tags || !tags.length) return "";
  return `<p class="mention__tags">${tags
    .slice(0, 10)
    .map((tag) => {
      const clean = String(tag).trim();
      const hash = clean.startsWith("#") || /\s/.test(clean) ? clean : `#${clean}`;
      return `<span class="mention__tag">${escapeHtml(hash)}</span>`;
    })
    .join(" ")}</p>`;
}

function compact(value) {
  const number = Number(value || 0);
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
  if (number >= 1_000) return `${Math.round(number / 1000)}K`;
  return String(number);
}
