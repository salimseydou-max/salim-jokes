function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value) {
  const time = Date.parse(value || "");
  if (!Number.isFinite(time)) {
    return "";
  }
  return new Date(time).toLocaleDateString();
}

async function fileToDataUrl(file) {
  if (!file) {
    return "";
  }
  if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type || "")) {
    throw new Error("Please choose PNG, JPG, or WebP.");
  }
  if (file.size > 950000) {
    throw new Error("Image should be under 950KB.");
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(String(reader.result || ""));
    };
    reader.onerror = () => {
      reject(new Error("Image read failed."));
    };
    reader.readAsDataURL(file);
  });
}

function renderList(target, items, emptyText, itemRenderer) {
  if (!target) {
    return;
  }
  target.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "section-copy";
    empty.textContent = emptyText;
    target.appendChild(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < items.length; i += 1) {
    fragment.appendChild(itemRenderer(items[i]));
  }
  target.appendChild(fragment);
}

export function createProfileView(options = {}) {
  const root = options.root;
  const authService = options.authService;
  const favoritesStore = options.favoritesStore;
  const submissionStore = options.submissionStore;
  const reactionStore = options.reactionStore;
  const toast = options.toast;
  const getViewerId = typeof options.getViewerId === "function" ? options.getViewerId : () => "guest";
  const onUserChanged =
    typeof options.onUserChanged === "function" ? options.onUserChanged : () => {};

  const authCard = root?.querySelector("[data-profile-auth-card]");
  const accountCard = root?.querySelector("[data-profile-account-card]");
  const loginForm = root?.querySelector("[data-profile-login-form]");
  const signupForm = root?.querySelector("[data-profile-signup-form]");
  const editForm = root?.querySelector("[data-profile-edit-form]");
  const logoutButton = root?.querySelector("[data-profile-logout]");

  const profileName = root?.querySelector("[data-profile-name]");
  const profileEmail = root?.querySelector("[data-profile-email]");
  const profileAvatar = root?.querySelector("[data-profile-avatar]");
  const profileStats = root?.querySelector("[data-profile-stats]");

  const savedList = root?.querySelector("[data-profile-saved-list]");
  const submittedList = root?.querySelector("[data-profile-submitted-list]");
  const reactionsList = root?.querySelector("[data-profile-reactions-list]");

  function getOwnerId() {
    return authService.getUser()?.id || getViewerId();
  }

  function setAuthVisibility(authenticated) {
    if (authCard) {
      authCard.hidden = authenticated;
    }
    if (accountCard) {
      accountCard.hidden = !authenticated;
    }
  }

  function renderSavedList() {
    const savedItems = favoritesStore.list().slice(0, 30);
    renderList(
      savedList,
      savedItems,
      "Saved jokes will appear here.",
      (entry) => {
        const article = document.createElement("article");
        article.className = "mini-list-item";
        article.innerHTML = `
          <p>${escapeHtml(entry.text)}</p>
          <span class="mini-list-meta">${escapeHtml(entry.category || "random")} • ${formatDate(
          entry.savedAt
        )}</span>
        `;
        return article;
      }
    );
  }

  function renderSubmittedList() {
    const entries = submissionStore.listByOwner(getOwnerId()).slice(0, 30);
    renderList(
      submittedList,
      entries,
      "Your submitted jokes will appear here.",
      (entry) => {
        const article = document.createElement("article");
        article.className = "mini-list-item";
        article.innerHTML = `
          <p>${escapeHtml(entry.text)}</p>
          <span class="mini-list-meta">${escapeHtml(entry.category || "random")} • ${formatDate(
          entry.createdAt
        )}</span>
        `;
        return article;
      }
    );
  }

  function renderReactionHistory() {
    const history = reactionStore.listUserHistory(getOwnerId()).slice(0, 30);
    renderList(
      reactionsList,
      history,
      "Your reaction history will appear here.",
      (entry) => {
        const article = document.createElement("article");
        article.className = "mini-list-item";
        article.innerHTML = `
          <p><strong>${escapeHtml(entry.reaction)}</strong> ${escapeHtml(entry.joke?.text || "")}</p>
          <span class="mini-list-meta">${escapeHtml(entry.joke?.category || "joke")} • ${formatDate(
          entry.joke?.createdAt
        )}</span>
        `;
        return article;
      }
    );
  }

  function renderAccount(user) {
    setAuthVisibility(Boolean(user));
    if (!user) {
      return;
    }
    if (profileName) {
      profileName.textContent = user.displayName || "User";
    }
    if (profileEmail) {
      profileEmail.textContent = user.email || "";
    }
    if (profileAvatar) {
      profileAvatar.src = user.avatarUrl || "";
    }
    if (profileStats) {
      const views = Number(user?.stats?.jokeViews) || 0;
      const favorites = Number(user?.stats?.favoritesAdded) || 0;
      const likes = Number(user?.stats?.likesAdded) || 0;
      profileStats.textContent = `Views ${views} • Favorites ${favorites} • Likes ${likes}`;
    }
    const nameInput = editForm?.querySelector("[name='displayName']");
    const phoneInput = editForm?.querySelector("[name='phoneNumber']");
    if (nameInput) {
      nameInput.value = user.displayName || "";
    }
    if (phoneInput) {
      phoneInput.value = user.phoneNumber || "";
    }
    renderSavedList();
    renderSubmittedList();
    renderReactionHistory();
  }

  async function submitLogin(event) {
    event.preventDefault();
    const email = loginForm?.querySelector("[name='email']")?.value || "";
    const password = loginForm?.querySelector("[name='password']")?.value || "";
    try {
      const user = await authService.login({ email, password });
      toast?.show("Logged in.");
      renderAccount(user);
      onUserChanged(user);
    } catch (error) {
      toast?.show(error.message || "Login failed.", "error");
    }
  }

  async function submitSignup(event) {
    event.preventDefault();
    const username = signupForm?.querySelector("[name='username']")?.value || "";
    const email = signupForm?.querySelector("[name='email']")?.value || "";
    const password = signupForm?.querySelector("[name='password']")?.value || "";
    const avatarFile = signupForm?.querySelector("[name='avatar']")?.files?.[0];
    try {
      const avatarUrl = avatarFile ? await fileToDataUrl(avatarFile) : "";
      const user = await authService.signup({ username, email, password, avatarUrl });
      toast?.show("Account created.");
      signupForm?.reset();
      renderAccount(user);
      onUserChanged(user);
    } catch (error) {
      toast?.show(error.message || "Signup failed.", "error");
    }
  }

  async function submitProfileUpdate(event) {
    event.preventDefault();
    const displayName = editForm?.querySelector("[name='displayName']")?.value || "";
    const phoneNumber = editForm?.querySelector("[name='phoneNumber']")?.value || "";
    const avatarFile = editForm?.querySelector("[name='avatar']")?.files?.[0];
    try {
      const avatarUrl = avatarFile ? await fileToDataUrl(avatarFile) : "";
      const user = await authService.updateProfile({ displayName, phoneNumber, avatarUrl });
      toast?.show("Profile updated.");
      renderAccount(user);
      onUserChanged(user);
    } catch (error) {
      toast?.show(error.message || "Profile update failed.", "error");
    }
  }

  async function handleLogout() {
    await authService.logout();
    renderAccount(null);
    setAuthVisibility(false);
    toast?.show("Logged out.");
    onUserChanged(null);
  }

  function init() {
    loginForm?.addEventListener("submit", submitLogin);
    signupForm?.addEventListener("submit", submitSignup);
    editForm?.addEventListener("submit", submitProfileUpdate);
    logoutButton?.addEventListener("click", handleLogout);
    authService.subscribe((user) => {
      renderAccount(user);
      onUserChanged(user);
    });
  }

  async function activate() {
    const user = await authService.refreshSession();
    renderAccount(user);
    setAuthVisibility(Boolean(user));
    if (!user) {
      renderSavedList();
      renderSubmittedList();
      renderReactionHistory();
    }
  }

  init();

  return {
    activate,
    refreshCollections() {
      renderSavedList();
      renderSubmittedList();
      renderReactionHistory();
    },
    getOwnerId,
  };
}
