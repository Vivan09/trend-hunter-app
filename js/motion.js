// Хелперы движения.
//
// Длительности и кривые живут в CSS. Сюда попадает только то, чего CSS не
// умеет: расстановка задержек по списку и ожидание конца анимации.

/* Потолок лесенки. Без него список из сорока трендов проступал бы почти
   секунду: 40 × 22мс. */
const STAGGER_MAX = 8;

/** Расставляет --i по детям контейнера. */
export function stagger(root, selector = ":scope > *") {
  if (!root) return;
  root.querySelectorAll(selector).forEach((node, i) => {
    node.style.setProperty("--i", String(Math.min(i, STAGGER_MAX)));
  });
}

/**
 * Промис на конец анимации.
 *
 * Страховочный таймаут обязателен: при prefers-reduced-motion, на скрытой
 * вкладке или если класс не дал анимации, animationend не придёт никогда, и
 * без таймаута колода залипнет навсегда.
 *
 * 1000 — не длительность анимации, а предохранитель на случай, когда
 * animationend не придёт вообще. Предохранителю нужен заведомый запас, а не
 * точность, поэтому он намеренно не токен: токены описывают воспринимаемое
 * движение, а это число никто не видит. Значение обязано превышать любую
 * длительность из tokens.css (самая долгая сейчас — --t-slow: 420ms).
 */
export function afterAnimation(el, fallbackMs = 1000) {
  return new Promise((resolve) => {
    if (!el) {
      resolve();
      return;
    }
    // Если анимации нет вовсе — ждать нечего. Без этой проверки снятый слой
    // движения превращал бы предохранитель в секундную паузу на каждый вердикт.
    if (!el.getAnimations || !el.getAnimations().length) {
      resolve();
      return;
    }
    let done = false;
    let timer;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      el.removeEventListener("animationend", finish);
      resolve();
    };
    el.addEventListener("animationend", finish);
    timer = setTimeout(finish, fallbackMs);
  });
}
