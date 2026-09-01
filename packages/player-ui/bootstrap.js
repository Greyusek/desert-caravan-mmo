// @ts-check

const BOOTSTRAP_TIMEOUT_MS = 10_000;
const loadingState = document.getElementById("loading-state");
const workspace = document.getElementById("workspace");
const errorState = document.getElementById("error-state");
const errorDetail = document.getElementById("error-detail");
const retryButton = document.getElementById("retry-button");

if (
  loadingState instanceof HTMLElement &&
  workspace instanceof HTMLElement &&
  errorState instanceof HTMLElement &&
  errorDetail instanceof HTMLElement &&
  retryButton instanceof HTMLButtonElement
) {
  /** @param {string} message */
  const showBootstrapError = (message) => {
    loadingState.hidden = true;
    workspace.hidden = true;
    errorDetail.textContent = message;
    errorState.hidden = false;
  };
  const bootstrapTimeout = window.setTimeout(() => {
    showBootstrapError(
      "Запуск занял больше 10 секунд. Проверьте терминал Player UI и повторите.",
    );
  }, BOOTSTRAP_TIMEOUT_MS);

  retryButton.addEventListener("click", () => window.location.reload());
  window.addEventListener(
    "player-ui:ready",
    () => window.clearTimeout(bootstrapTimeout),
    { once: true },
  );
  window.addEventListener(
    "player-ui:error",
    (event) => {
      window.clearTimeout(bootstrapTimeout);
      const message =
        event instanceof CustomEvent &&
        event.detail &&
        typeof event.detail.message === "string"
          ? event.detail.message
          : "Неизвестная ошибка локального интерфейса.";
      showBootstrapError(message);
    },
    { once: true },
  );

  import("./main.js").catch((error) => {
    console.error("Player UI module failed to load", error);
    window.clearTimeout(bootstrapTimeout);
    showBootstrapError(
      "Браузер не загрузил модуль интерфейса. Обновите страницу с очисткой кэша.",
    );
  });

}
