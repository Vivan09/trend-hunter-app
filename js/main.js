// Точка входа дашборда. Сборки нет — только нативные ES-модули (конституция V).

import { route, setNotFound, start } from "./router.js";
import { aiChartView } from "./views/aichart.js";
import { html } from "./format.js";
import { dashboardView } from "./views/dashboard.js";
import { trendsView } from "./views/trends.js";
import { trendView } from "./views/trend.js";
import { candidatesView } from "./views/candidates.js";
import { deckView } from "./views/deck.js";
import { analyticsView } from "./views/analytics.js";
import { workspaceView } from "./views/workspace.js";
import { notificationsView } from "./views/notifications.js";
import { myGamesView } from "./views/mygames.js";

route("/", dashboardView);
route("/trends", trendsView);
route("/trend/:slug", trendView);
route("/candidates", candidatesView);
route("/ai", aiChartView);
route("/deck", deckView);
route("/analytics", analyticsView);
route("/workspace", workspaceView);
route("/notifications", notificationsView);
route("/mygames", myGamesView);

setNotFound((mount) => {
  mount.insertAdjacentHTML(
    "beforeend",
    html`
      <div class="empty">
        <b>Раздела нет</b>
        <p>Вернуться к <a href="#/trends">списку трендов</a>.</p>
      </div>
    `,
  );
});

start(document.querySelector("#view"));
