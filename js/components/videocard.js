// Карточка видео (FR-012).
//
// Источник текста подписан всегда. Субтитры — то, что сказано в ролике;
// распознавание — то, что расслышала модель. Разница важна: на распознанном
// тексте нельзя строить вывод с той же уверенностью, что на субтитрах.

import { html, raw, escapeHtml } from "../format.js";

const TEXT_SOURCES = {
  subtitles: "субтитры",
  asr: "распознано",
  none: "",
};

export function videoCard(video) {
  const source = TEXT_SOURCES[video.text_source] || "";
  return html`
    <li class="videocard">
      <div class="videocard__head">
        <a class="videocard__author" href="${video.url}" target="_blank" rel="noreferrer">
          ${video.author || "без автора"}
        </a>
        ${raw(video.provider ? html`<span class="tag">${video.provider}</span>` : "")}
      </div>
      <dl class="videocard__stats">
        ${raw(stat("просмотры", video.views))} ${raw(stat("лайки", video.likes))}
        ${raw(stat("комменты", video.comments))} ${raw(stat("репосты", video.reposts))}
      </dl>
      ${raw(
        video.description
          ? html`<p class="videocard__text">${video.description}</p>`
          : "",
      )}
      ${raw(hashtags(video.hashtags))} ${raw(music(video.music))}
      ${raw(
        video.text
          ? html`<p class="videocard__quote">
              <span class="tag">${source}</span> ${video.text}
            </p>`
          : "",
      )}
    </li>
  `;
}

export function videoList(videos, limit = 12) {
  if (!videos || !videos.length) {
    return html`<p class="note">Видео к этому тренду не собрано.</p>`;
  }
  const sorted = [...videos].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, limit);
  return html`<ul class="videos">
    ${raw(sorted.map(videoCard).join(""))}
  </ul>`;
}

function stat(label, value) {
  return html`
    <div class="metric">
      <dt class="metric__label">${label}</dt>
      <dd class="metric__value">${compact(value)}</dd>
    </div>
  `;
}

function compact(value) {
  const number = Number(value || 0);
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
  if (number >= 1_000) return `${Math.round(number / 1000)}K`;
  return String(number);
}

function hashtags(tags) {
  if (!tags || !tags.length) return "";
  return `<p class="videocard__tags">${tags
    .slice(0, 8)
    .map((tag) => escapeHtml(tag))
    .join(" ")}</p>`;
}

function music(track) {
  if (!track || !track.title) return "";
  return html`<p class="videocard__music">♪ ${track.title}${raw(
    track.author ? escapeHtml(` — ${track.author}`) : "",
  )}</p>`;
}
