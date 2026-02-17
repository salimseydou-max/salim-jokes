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

function sanitizePhone(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  const plus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return "";
  }
  return `${plus ? "+" : ""}${digits}`;
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
  const verificationService = options.verificationService;
  const favoritesStore = options.favoritesStore;
  const submissionStore = options.submissionStore;
  const reactionStore = options.reactionStore;
  const commentStore = options.commentStore;
  const i18nService = options.i18nService;
  const notificationStore = options.notificationStore;
  const toast = options.toast;
  const getViewerId = typeof options.getViewerId === "function" ? options.getViewerId : () => "guest";
  const onUserChanged =
    typeof options.onUserChanged === "function" ? options.onUserChanged : () => {};

  const authCard = root?.querySelector("[data-profile-auth-card]");
  const accountCard = root?.querySelector("[data-profile-account-card]");
  const authModeButtons = Array.from(root?.querySelectorAll("[data-auth-mode-button]") || []);
  const authPanels = Array.from(root?.querySelectorAll("[data-auth-panel]") || []);
  const loginForm = root?.querySelector("[data-profile-login-form]");
  const googleLoginButton = root?.querySelector("[data-profile-google-login]");
  const signupForm = root?.querySelector("[data-profile-signup-form]");
  const editForm = root?.querySelector("[data-profile-edit-form]");
  const logoutButton = root?.querySelector("[data-profile-logout]");

  const sendCodeButton = root?.querySelector("[data-signup-send-code]");
  const verifyCodeButton = root?.querySelector("[data-signup-verify-code]");
  const verificationCodeInput = root?.querySelector("[data-signup-verification-code]");
  const verificationStatus = root?.querySelector("[data-signup-verification-status]");
  const signupLanguageSelect = root?.querySelector("[data-signup-language]");
  const profileLanguageSelect = root?.querySelector("[data-profile-language]");

  const profileName = root?.querySelector("[data-profile-name]");
  const profileEmail = root?.querySelector("[data-profile-email]");
  const profilePhone = root?.querySelector("[data-profile-phone]");
  const profileAvatar = root?.querySelector("[data-profile-avatar]");
  const profileStats = root?.querySelector("[data-profile-stats]");

  const summarySaved = root?.querySelector("[data-profile-summary-saved]");
  const summarySubmitted = root?.querySelector("[data-profile-summary-submitted]");
  const summaryReactions = root?.querySelector("[data-profile-summary-reactions]");
  const summaryComments = root?.querySelector("[data-profile-summary-comments]");

  const savedList = root?.querySelector("[data-profile-saved-list]");
  const submittedList = root?.querySelector("[data-profile-submitted-list]");
  const reactionsList = root?.querySelector("[data-profile-reactions-list]");
  const commentsList = root?.querySelector("[data-profile-comments-list]");

  let verificationState = {
    emailVerified: false,
    phoneVerified: false,
  };

  function getOwnerId() {
    return authService.getUser()?.id || getViewerId();
  }

  function setVerificationStatus(message, type = "") {
    if (!verificationStatus) {
      return;
    }
    verificationStatus.textContent = message;
    verificationStatus.classList.remove("is-success", "is-error");
    if (type === "success") {
      verificationStatus.classList.add("is-success");
    }
    if (type === "error") {
      verificationStatus.classList.add("is-error");
    }
  }

  function refreshVerificationState() {
    const email = signupForm?.querySelector("[name='email']")?.value || "";
    const phone = sanitizePhone(signupForm?.querySelector("[name='phoneNumber']")?.value || "");
    verificationState = {
      emailVerified: verificationService.isVerified("email", email),
      phoneVerified: phone ? verificationService.isVerified("phone", phone) : false,
    };
    if (verificationState.emailVerified || verificationState.phoneVerified) {
      const channel = verificationState.emailVerified ? "email" : "phone";
      setVerificationStatus(`Verified via ${channel}.`, "success");
    } else {
      setVerificationStatus("Verify at least email or phone before creating the account.");
    }
  }

  function setAuthVisibility(authenticated) {
    if (authCard) {
      authCard.hidden = authenticated;
    }
    if (accountCard) {
      accountCard.hidden = !authenticated;
    }
  }

  function setAuthMode(mode) {
    const normalized = mode === "signup" ? "signup" : "signin";
    authModeButtons.forEach((button) => {
      const active = button.getAttribute("data-auth-mode-button") === normalized;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    authPanels.forEach((panel) => {
      const active = panel.getAttribute("data-auth-panel") === normalized;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
  }

  function populateLanguageOptions(select, selected) {
    if (!select || !i18nService) {
      return;
    }
    const languages = i18nService.getSupportedLanguages();
    const current = String(selected || "en").slice(0, 2).toLowerCase();
    select.innerHTML = "";
    for (let i = 0; i < languages.length; i += 1) {
      const option = document.createElement("option");
      option.value = languages[i].code;
      option.textContent = `${languages[i].label} (${languages[i].code})`;
      select.appendChild(option);
    }
    select.value = languages.some((entry) => entry.code === current) ? current : "en";
  }

  function renderSavedList() {
    const savedItems = favoritesStore.list().slice(0, 30);
    renderList(savedList, savedItems, "Saved jokes will appear here.", (entry) => {
      const article = document.createElement("article");
      article.className = "mini-list-item";
      article.innerHTML = `
        <p>${escapeHtml(entry.text)}</p>
        <span class="mini-list-meta">${escapeHtml(entry.category || "random")} • ${formatDate(
        entry.savedAt
      )}</span>
      `;
      return article;
    });
    if (summarySaved) {
      summarySaved.textContent = String(savedItems.length);
    }
  }

  function renderSubmittedList() {
    const entries = submissionStore.listByOwner(getOwnerId()).slice(0, 30);
    renderList(submittedList, entries, "Your submitted jokes will appear here.", (entry) => {
      const article = document.createElement("article");
      article.className = "mini-list-item";
      article.innerHTML = `
        <p>${escapeHtml(entry.text)}</p>
        <span class="mini-list-meta">${escapeHtml(entry.category || "random")} • ${formatDate(
        entry.createdAt
      )}</span>
      `;
      return article;
    });
    if (summarySubmitted) {
      summarySubmitted.textContent = String(entries.length);
    }
  }

  function renderReactionHistory() {
    const history = reactionStore.listUserHistory(getOwnerId()).slice(0, 30);
    renderList(reactionsList, history, "Your reaction history will appear here.", (entry) => {
      const article = document.createElement("article");
      article.className = "mini-list-item";
      article.innerHTML = `
        <p><strong>${escapeHtml(entry.reaction)}</strong> ${escapeHtml(entry.joke?.text || "")}</p>
        <span class="mini-list-meta">${escapeHtml(entry.joke?.category || "joke")} • ${formatDate(
        entry.joke?.createdAt
      )}</span>
      `;
      return article;
    });
    if (summaryReactions) {
      summaryReactions.textContent = String(history.length);
    }
  }

  function renderCommentHistory() {
    const history = commentStore?.listUserComments?.(getOwnerId()) || [];
    const limited = history.slice(0, 30);
    renderList(commentsList, limited, "Your comment history will appear here.", (entry) => {
      const article = document.createElement("article");
      article.className = "mini-list-item";
      article.innerHTML = `
        <p>${escapeHtml(entry.text)}</p>
        <span class="mini-list-meta">${formatDate(entry.createdAt)} • ${escapeHtml(
        entry.joke?.id || "joke"
      )}</span>
      `;
      return article;
    });
    if (summaryComments) {
      summaryComments.textContent = String(limited.length);
    }
  }

  function renderCollections() {
    renderSavedList();
    renderSubmittedList();
    renderReactionHistory();
    renderCommentHistory();
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
      profileEmail.textContent = user.email ? `Email: ${user.email}` : "Email: not set";
    }
    if (profilePhone) {
      profilePhone.textContent = user.phoneNumber ? `Phone: ${user.phoneNumber}` : "Phone: not set";
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
    const emailInput = editForm?.querySelector("[name='email']");
    const phoneInput = editForm?.querySelector("[name='phoneNumber']");
    const languageInput = editForm?.querySelector("[name='language']");
    if (nameInput) {
      nameInput.value = user.displayName || "";
    }
    if (emailInput) {
      emailInput.value = user.email || "";
    }
    if (phoneInput) {
      phoneInput.value = user.phoneNumber || "";
    }
    if (languageInput) {
      populateLanguageOptions(languageInput, user.language || user?.profile?.preferences?.language || "en");
    }
    renderCollections();
  }

  async function sendVerificationCode() {
    const email = signupForm?.querySelector("[name='email']")?.value || "";
    const phone = sanitizePhone(signupForm?.querySelector("[name='phoneNumber']")?.value || "");
    const type = phone ? "phone" : "email";
    const target = type === "phone" ? phone : email;
    if (!target) {
      setVerificationStatus("Enter a valid phone or email before requesting a code.", "error");
      return;
    }
    try {
      const result = await verificationService.requestCode(type, target);
      const maskedTarget =
        result?.delivery?.maskedTarget ||
        (type === "phone"
          ? `***${String(target || "").replace(/\D/g, "").slice(-4)}`
          : String(target || ""));
      setVerificationStatus(
        `Verification code sent via ${type === "phone" ? "SMS" : "email"} to ${maskedTarget}.`,
        "success"
      );
      notificationStore?.add({
        type: "verification",
        title: "Verification sent",
        message:
          result?.delivery?.mock === true
            ? "Verification is using mock delivery. Configure SMS/email providers for live delivery."
            : `A code was sent via ${type === "phone" ? "SMS" : "email"}.`,
      });
    } catch (error) {
      setVerificationStatus(error.message || "Failed to send code.", "error");
    }
  }

  function confirmVerificationCode() {
    const email = signupForm?.querySelector("[name='email']")?.value || "";
    const phone = sanitizePhone(signupForm?.querySelector("[name='phoneNumber']")?.value || "");
    const code = verificationCodeInput?.value || "";
    const verifiedPhone = phone ? verificationService.verifyCode("phone", phone, code) : false;
    const verifiedEmail = email ? verificationService.verifyCode("email", email, code) : false;
    if (!verifiedPhone && !verifiedEmail) {
      setVerificationStatus("Invalid or expired verification code.", "error");
      return;
    }
    const channel = verifiedPhone ? "phone" : "email";
    refreshVerificationState();
    toast?.show(`${channel} verified.`);
  }

  async function submitLogin(event) {
    event.preventDefault();
    const identifier = loginForm?.querySelector("[name='identifier']")?.value || "";
    const password = loginForm?.querySelector("[name='password']")?.value || "";
    try {
      const user = await authService.login({ identifier, password });
      toast?.show("Logged in.");
      notificationStore?.add({
        type: "login",
        title: "Login successful",
        message: "You signed in successfully.",
      });
      renderAccount(user);
      onUserChanged(user);
    } catch (error) {
      toast?.show(error.message || "Login failed.", "error");
    }
  }

  async function submitSignup(event) {
    event.preventDefault();
    refreshVerificationState();
    if (!verificationState.emailVerified && !verificationState.phoneVerified) {
      toast?.show("Verify email or phone before signup.", "error");
      return;
    }

    const username = signupForm?.querySelector("[name='username']")?.value || "";
    const email = signupForm?.querySelector("[name='email']")?.value || "";
    const phoneNumber = sanitizePhone(signupForm?.querySelector("[name='phoneNumber']")?.value || "");
    const language =
      signupForm?.querySelector("[name='language']")?.value || i18nService?.getLanguage?.() || "en";
    const password = signupForm?.querySelector("[name='password']")?.value || "";
    const avatarFile = signupForm?.querySelector("[name='avatar']")?.files?.[0];
    if (!email && !phoneNumber) {
      toast?.show("Provide email or phone number to continue.", "error");
      return;
    }

    try {
      const avatarUrl = avatarFile ? await fileToDataUrl(avatarFile) : "";
      const user = await authService.signup({
        username,
        email,
        phoneNumber,
        language,
        password,
        avatarUrl,
      });
      toast?.show("Account created.");
      notificationStore?.add({
        type: "signup",
        title: "Account created",
        message: "Your account was created successfully.",
      });
      signupForm?.reset();
      populateLanguageOptions(signupLanguageSelect, i18nService?.getLanguage?.() || "en");
      if (verificationCodeInput) {
        verificationCodeInput.value = "";
      }
      setVerificationStatus("Account created and verified.", "success");
      renderAccount(user);
      onUserChanged(user);
    } catch (error) {
      toast?.show(error.message || "Signup failed.", "error");
    }
  }

  async function handleGoogleLogin() {
    try {
      const user = await authService.loginWithGoogle({
        language: i18nService?.getLanguage?.() || "en",
      });
      toast?.show("Signed in with Google.");
      notificationStore?.add({
        type: "login",
        title: "Google sign-in",
        message: "You signed in with Google.",
      });
      renderAccount(user);
      onUserChanged(user);
    } catch (error) {
      toast?.show(error.message || "Google login canceled.", "error");
    }
  }

  async function submitProfileUpdate(event) {
    event.preventDefault();
    const displayName = editForm?.querySelector("[name='displayName']")?.value || "";
    const phoneNumber = editForm?.querySelector("[name='phoneNumber']")?.value || "";
    const language = editForm?.querySelector("[name='language']")?.value || "";
    const avatarFile = editForm?.querySelector("[name='avatar']")?.files?.[0];
    try {
      const avatarUrl = avatarFile ? await fileToDataUrl(avatarFile) : "";
      const user = await authService.updateProfile({ displayName, phoneNumber, avatarUrl, language });
      toast?.show("Profile updated.");
      renderAccount(user);
      onUserChanged(user);
    } catch (error) {
      toast?.show(error.message || "Profile update failed.", "error");
    }
  }

  async function handleLogout() {
    await authService.logout();
    notificationStore?.add({
      type: "account",
      title: "Logged out",
      message: "Your session ended on this device.",
    });
    renderAccount(null);
    setAuthVisibility(false);
    toast?.show("Logged out.");
    onUserChanged(null);
    renderCollections();
  }

  function init() {
    authModeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.getAttribute("data-auth-mode-button") || "signin";
        setAuthMode(mode);
      });
    });
    loginForm?.addEventListener("submit", submitLogin);
    googleLoginButton?.addEventListener("click", handleGoogleLogin);
    signupForm?.addEventListener("submit", submitSignup);
    editForm?.addEventListener("submit", submitProfileUpdate);
    logoutButton?.addEventListener("click", handleLogout);

    sendCodeButton?.addEventListener("click", () => sendVerificationCode());
    verifyCodeButton?.addEventListener("click", confirmVerificationCode);
    signupForm?.querySelector("[name='email']")?.addEventListener("input", refreshVerificationState);
    signupForm?.querySelector("[name='phoneNumber']")?.addEventListener("input", refreshVerificationState);
    populateLanguageOptions(signupLanguageSelect, i18nService?.getLanguage?.() || "en");
    populateLanguageOptions(profileLanguageSelect, i18nService?.getLanguage?.() || "en");
    setAuthMode("signin");
    i18nService?.subscribe?.(() => {
      populateLanguageOptions(
        signupLanguageSelect,
        signupForm?.querySelector("[name='language']")?.value || i18nService?.getLanguage?.() || "en"
      );
      populateLanguageOptions(
        profileLanguageSelect,
        editForm?.querySelector("[name='language']")?.value || i18nService?.getLanguage?.() || "en"
      );
    });

    authService.subscribe((user) => {
      renderAccount(user);
      onUserChanged(user);
    });
    refreshVerificationState();
  }

  async function activate() {
    const user = await authService.refreshSession();
    renderAccount(user);
    setAuthVisibility(Boolean(user));
    if (!user) {
      setAuthMode("signin");
    }
    if (!user) {
      renderCollections();
    }
  }

  function openEditInfo() {
    const user = authService.getUser();
    if (!user) {
      setAuthMode("signup");
      const signupFocus = signupForm?.querySelector("[name='username']");
      signupFocus?.focus();
      return;
    }
    setAuthVisibility(true);
    const displayNameInput = editForm?.querySelector("[name='displayName']");
    displayNameInput?.focus();
    displayNameInput?.select();
  }

  init();

  return {
    activate,
    refreshCollections: renderCollections,
    getOwnerId,
    openEditInfo,
  };
}
