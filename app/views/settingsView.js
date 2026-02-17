export function applyThemeToDocument(theme) {
  const root = document.documentElement;
  const resolved = theme === "system"
    ? (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
    : theme;
  const normalized = resolved === "light" ? "light" : "dark";
  root.setAttribute("data-theme", normalized);
  root.style.colorScheme = normalized;
}

function setFormValues(root, preferences) {
  const form = root?.querySelector("[data-settings-form]");
  if (!form || !preferences) {
    return;
  }
  const setChecked = (selector, value) => {
    const field = form.querySelector(selector);
    if (field) {
      field.checked = Boolean(value);
    }
  };
  const setValue = (selector, value) => {
    const field = form.querySelector(selector);
    if (field) {
      field.value = String(value || "");
    }
  };

  setValue("[name='language']", preferences.general?.language || "en");
  setValue("[name='theme']", preferences.appearance.theme);
  setChecked("[name='compactCards']", preferences.appearance.compactCards);
  setChecked("[name='notifNewJokes']", preferences.notifications.newJokes);
  setChecked("[name='notifReplies']", preferences.notifications.commentReplies);
  setChecked("[name='notifUpdates']", preferences.notifications.featureUpdates);
  setChecked("[name='notifActivity']", preferences.notifications.userActivity);
  setValue("[name='profileVisibility']", preferences.privacy.profileVisibility);
  setChecked("[name='allowActivitySync']", preferences.privacy.allowActivitySync);
  setValue("[name='socialWebsite']", preferences.socialLinks.website);
  setValue("[name='socialX']", preferences.socialLinks.x);
  setValue("[name='socialInstagram']", preferences.socialLinks.instagram);
  setValue("[name='socialYoutube']", preferences.socialLinks.youtube);
}

function readFormValues(form) {
  return {
    general: {
      language: form.querySelector("[name='language']")?.value || "en",
    },
    appearance: {
      theme: form.querySelector("[name='theme']")?.value || "dark",
      compactCards: Boolean(form.querySelector("[name='compactCards']")?.checked),
    },
    notifications: {
      newJokes: Boolean(form.querySelector("[name='notifNewJokes']")?.checked),
      commentReplies: Boolean(form.querySelector("[name='notifReplies']")?.checked),
      featureUpdates: Boolean(form.querySelector("[name='notifUpdates']")?.checked),
      userActivity: Boolean(form.querySelector("[name='notifActivity']")?.checked),
    },
    privacy: {
      profileVisibility: form.querySelector("[name='profileVisibility']")?.value || "private",
      allowActivitySync: Boolean(form.querySelector("[name='allowActivitySync']")?.checked),
    },
    socialLinks: {
      website: form.querySelector("[name='socialWebsite']")?.value || "",
      x: form.querySelector("[name='socialX']")?.value || "",
      instagram: form.querySelector("[name='socialInstagram']")?.value || "",
      youtube: form.querySelector("[name='socialYoutube']")?.value || "",
    },
  };
}

export function createSettingsView(options = {}) {
  const root = options.root;
  const preferencesStore = options.preferencesStore;
  const i18nService = options.i18nService;
  const authService = options.authService;
  const toast = options.toast;
  const notificationStore = options.notificationStore;

  const form = root?.querySelector("[data-settings-form]");
  const resetButton = root?.querySelector("[data-settings-reset]");
  const saveButton = root?.querySelector("[data-settings-save]");
  const accountInfo = root?.querySelector("[data-settings-account-info]");
  const languageSelect = root?.querySelector("[name='language']");
  const themeSelect = root?.querySelector("[name='theme']");

  function populateLanguageOptions() {
    if (!languageSelect || !i18nService) {
      return;
    }
    const current = languageSelect.value || "en";
    languageSelect.innerHTML = "";
    const languages = i18nService.getSupportedLanguages();
    for (let i = 0; i < languages.length; i += 1) {
      const option = document.createElement("option");
      option.value = languages[i].code;
      option.textContent = `${languages[i].label} (${languages[i].code})`;
      languageSelect.appendChild(option);
    }
    languageSelect.value = current;
  }

  function applyFromStore() {
    const preferences = preferencesStore.get();
    populateLanguageOptions();
    setFormValues(root, preferences);
    i18nService?.setLanguage(preferences.general?.language || "en");
    applyThemeToDocument(preferences.appearance.theme);
    i18nService?.applyTranslations(document);
    const user = authService?.getUser?.();
    if (accountInfo) {
      if (user) {
        accountInfo.textContent = `Signed in as ${user.displayName || "User"} (${user.email || "no email"})${
          user.phoneNumber ? ` • ${user.phoneNumber}` : ""
        }`;
      } else {
        accountInfo.textContent = "Sign in to manage your account information.";
      }
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    if (!form) {
      return;
    }
    const values = readFormValues(form);
    const updated = preferencesStore.update(values);
    i18nService?.setLanguage(updated.general?.language || "en");
    applyThemeToDocument(updated.appearance.theme);
    i18nService?.applyTranslations(document);
    toast?.show("Settings saved.");
    const user = authService?.getUser?.();
    if (user?.id) {
      authService
        .updateProfile({
          displayName: user.displayName,
          phoneNumber: user.phoneNumber,
          language: updated.general?.language || "en",
        })
        .catch(() => null);
    }
    if (updated.notifications.featureUpdates) {
      notificationStore?.add({
        type: "settings",
        title: "Settings updated",
        message: "Your preferences were saved successfully.",
      });
    }
  }

  function onReset() {
    preferencesStore.set(preferencesStore.defaults);
    applyFromStore();
    toast?.show("Settings reset.");
  }

  function init() {
    if (!form) {
      return;
    }
    form.addEventListener("submit", onSubmit);
    resetButton?.addEventListener("click", onReset);
    saveButton?.addEventListener("click", () => {
      // Allows dedicated mobile save tap without submitting keyboard unexpectedly.
    });
    themeSelect?.addEventListener("change", () => {
      applyThemeToDocument(themeSelect.value || "dark");
    });
    if (window.matchMedia) {
      const systemThemeQuery = window.matchMedia("(prefers-color-scheme: light)");
      const syncSystemTheme = () => {
        const selectedTheme = themeSelect?.value || preferencesStore.get().appearance.theme;
        if (selectedTheme === "system") {
          applyThemeToDocument("system");
        }
      };
      if (typeof systemThemeQuery.addEventListener === "function") {
        systemThemeQuery.addEventListener("change", syncSystemTheme);
      } else if (typeof systemThemeQuery.addListener === "function") {
        systemThemeQuery.addListener(syncSystemTheme);
      }
    }
    preferencesStore.subscribe((nextPrefs) => {
      i18nService?.setLanguage(nextPrefs.general?.language || "en");
      applyThemeToDocument(nextPrefs.appearance.theme);
      i18nService?.applyTranslations(document);
    });
    authService?.subscribe?.(() => {
      applyFromStore();
    });
    applyFromStore();
  }

  init();

  return {
    activate() {
      applyFromStore();
    },
  };
}
