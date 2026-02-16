export function createToast(element) {
  const toastElement = element;
  let hideTimer = null;

  function hide() {
    if (!toastElement) {
      return;
    }
    toastElement.classList.remove("is-visible", "is-success", "is-error");
    toastElement.textContent = "";
  }

  function show(message, type = "success", timeoutMs = 1800) {
    if (!toastElement || !message) {
      return;
    }
    if (hideTimer) {
      clearTimeout(hideTimer);
    }
    toastElement.textContent = String(message);
    toastElement.classList.remove("is-success", "is-error");
    toastElement.classList.add(type === "error" ? "is-error" : "is-success");
    toastElement.classList.add("is-visible");
    hideTimer = window.setTimeout(() => {
      hide();
    }, timeoutMs);
  }

  return {
    show,
    hide,
  };
}
