import { submitJoke } from "../services/jokesApi.js";

export function createSubmitView(options = {}) {
  const root = options.root;
  const toast = options.toast;
  const onSubmitted = typeof options.onSubmitted === "function" ? options.onSubmitted : () => {};
  const notificationStore = options.notificationStore;

  const form = root?.querySelector("[data-submit-form]");
  const textarea = root?.querySelector("[data-submit-text]");
  const categoryField = root?.querySelector("[data-submit-category]");
  const tagsField = root?.querySelector("[data-submit-tags]");
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
      const joke = await submitJoke({
        text,
        category: categoryField?.value || "random",
        language: "en",
        tags: [
          "user-submitted",
          ...(String(tagsField?.value || "")
            .split(",")
            .map((tag) => tag.trim().toLowerCase())
            .filter(Boolean)
            .slice(0, 6)),
        ],
      });
      toast?.show("Thanks! Your joke was submitted.");
      notificationStore?.add({
        type: "user-activity",
        title: "Submission received",
        message: "Your new joke was added and may appear in the live feed soon.",
      });
      form?.reset();
      updateCounter();
      onSubmitted(joke);
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
