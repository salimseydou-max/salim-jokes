import { submitJoke } from "../services/jokesApi.js";

export function createSubmitView(options = {}) {
  const root = options.root;
  const toast = options.toast;
  const onSubmitted = typeof options.onSubmitted === "function" ? options.onSubmitted : () => {};

  const form = root?.querySelector("[data-submit-form]");
  const textarea = root?.querySelector("[data-submit-text]");
  const button = root?.querySelector("[data-submit-button]");
  const counter = root?.querySelector("[data-submit-counter]");

  function updateCounter() {
    if (!counter || !textarea) {
      return;
    }
    const length = textarea.value.trim().length;
    counter.textContent = `${length}/480`;
  }

  function setLoading(isLoading) {
    if (!button) {
      return;
    }
    button.disabled = isLoading;
    button.textContent = isLoading ? "Submitting..." : "Submit Joke";
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!textarea) {
      return;
    }
    const text = textarea.value.trim();
    if (text.length < 10) {
      toast?.show("Write at least 10 characters.", "error");
      return;
    }

    setLoading(true);
    try {
      await submitJoke({
        text,
        category: "random",
        language: "en",
      });
      toast?.show("Thanks! Your joke was submitted.");
      form?.reset();
      updateCounter();
      onSubmitted();
    } catch (error) {
      toast?.show("Submission failed. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  function init() {
    if (!form || !textarea) {
      return;
    }
    textarea.addEventListener("input", updateCounter);
    form.addEventListener("submit", onSubmit);
    updateCounter();
  }

  init();

  return {
    focus() {
      textarea?.focus();
    },
  };
}
