const SUPPORTED_LANGUAGES = Object.freeze([
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "ar", label: "العربية" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "ru", label: "Русский" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "hi", label: "हिन्दी" },
  { code: "ur", label: "اردو" },
  { code: "tr", label: "Türkçe" },
  { code: "nl", label: "Nederlands" },
  { code: "sv", label: "Svenska" },
  { code: "pl", label: "Polski" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "th", label: "ไทย" },
  { code: "fa", label: "فارسی" },
  { code: "he", label: "עברית" },
  { code: "bn", label: "বাংলা" },
  { code: "sw", label: "Kiswahili" },
]);

const DICTIONARY = Object.freeze({
  en: {
    "nav.feed": "Feed",
    "nav.submit": "Submit Joke",
    "menu.profile": "Profile",
    "menu.editInfo": "Edit Info",
    "menu.settings": "Settings",
    "menu.notifications": "Notifications",
    "menu.logout": "Log Out",
    "menu.about": "About / Creator",
    "menu.privacy": "Privacy policy",
    "menu.help": "Help center",
    "menu.social": "Social links",
    "menu.contact": "Contact support",
    "search.placeholder": "Search jokes, tags, categories...",
    "search.meta.default": "Mixing AI, user, trending, recent, and random jokes.",
    "profile.signIn": "Sign in",
    "profile.signUp": "Create account",
    "settings.title": "Settings",
    "settings.language": "Language",
    "common.save": "Save",
    "common.reset": "Reset",
    "common.close": "Close",
    "auth.google": "Continue with Google",
  },
  fr: {
    "nav.feed": "Fil",
    "nav.submit": "Soumettre",
    "menu.profile": "Profil",
    "menu.editInfo": "Modifier les infos",
    "menu.settings": "Paramètres",
    "menu.notifications": "Notifications",
    "menu.logout": "Se déconnecter",
    "menu.about": "À propos / Créateur",
    "menu.privacy": "Politique de confidentialité",
    "menu.help": "Centre d'aide",
    "menu.social": "Liens sociaux",
    "menu.contact": "Contacter le support",
    "search.placeholder": "Rechercher blagues, tags, catégories...",
    "search.meta.default": "Mélange IA, utilisateur, tendance, récent et aléatoire.",
    "profile.signIn": "Se connecter",
    "profile.signUp": "Créer un compte",
    "settings.title": "Paramètres",
    "settings.language": "Langue",
    "common.save": "Enregistrer",
    "common.reset": "Réinitialiser",
    "common.close": "Fermer",
    "auth.google": "Continuer avec Google",
  },
  es: {
    "nav.feed": "Inicio",
    "nav.submit": "Enviar chiste",
    "menu.profile": "Perfil",
    "menu.editInfo": "Editar datos",
    "menu.settings": "Configuración",
    "menu.notifications": "Notificaciones",
    "menu.logout": "Cerrar sesión",
    "menu.about": "Acerca de / Creador",
    "menu.privacy": "Política de privacidad",
    "menu.help": "Centro de ayuda",
    "menu.social": "Enlaces sociales",
    "menu.contact": "Contactar soporte",
    "search.placeholder": "Buscar chistes, etiquetas, categorías...",
    "search.meta.default": "Mezcla IA, usuarios, tendencia, reciente y aleatorio.",
    "profile.signIn": "Iniciar sesión",
    "profile.signUp": "Crear cuenta",
    "settings.title": "Configuración",
    "settings.language": "Idioma",
    "common.save": "Guardar",
    "common.reset": "Restablecer",
    "common.close": "Cerrar",
    "auth.google": "Continuar con Google",
  },
  ar: {
    "nav.feed": "الخلاصة",
    "nav.submit": "إرسال نكتة",
    "menu.profile": "الملف الشخصي",
    "menu.editInfo": "تعديل المعلومات",
    "menu.settings": "الإعدادات",
    "menu.notifications": "الإشعارات",
    "menu.logout": "تسجيل الخروج",
    "menu.about": "حول / المطور",
    "menu.privacy": "سياسة الخصوصية",
    "menu.help": "مركز المساعدة",
    "menu.social": "روابط التواصل",
    "menu.contact": "اتصل بالدعم",
    "search.placeholder": "ابحث عن النكات أو الوسوم أو الفئات...",
    "search.meta.default": "مزيج من نكات الذكاء الاصطناعي والمستخدمين والرائجة والحديثة والعشوائية.",
    "profile.signIn": "تسجيل الدخول",
    "profile.signUp": "إنشاء حساب",
    "settings.title": "الإعدادات",
    "settings.language": "اللغة",
    "common.save": "حفظ",
    "common.reset": "إعادة تعيين",
    "common.close": "إغلاق",
    "auth.google": "المتابعة عبر Google",
  },
});

function normalizeLanguage(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "en";
  }
  if (SUPPORTED_LANGUAGES.some((entry) => entry.code === normalized)) {
    return normalized;
  }
  return "en";
}

function resolveLocaleLanguage() {
  const browserLang = String(navigator.language || "en").slice(0, 2).toLowerCase();
  return normalizeLanguage(browserLang);
}

function getTranslationMap(language) {
  return DICTIONARY[language] || DICTIONARY.en || {};
}

export function createI18nService(options = {}) {
  let language = normalizeLanguage(options.defaultLanguage || resolveLocaleLanguage());
  const listeners = new Set();

  function t(key, fallback = "") {
    const currentMap = getTranslationMap(language);
    if (Object.prototype.hasOwnProperty.call(currentMap, key)) {
      return currentMap[key];
    }
    const fallbackMap = getTranslationMap("en");
    if (Object.prototype.hasOwnProperty.call(fallbackMap, key)) {
      return fallbackMap[key];
    }
    return fallback || key;
  }

  function getLanguage() {
    return language;
  }

  function getSupportedLanguages() {
    return SUPPORTED_LANGUAGES.slice();
  }

  function applyTranslations(root = document) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return;
    }
    root.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.getAttribute("data-i18n");
      if (!key) {
        return;
      }
      element.textContent = t(key, element.textContent || "");
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      const key = element.getAttribute("data-i18n-placeholder");
      if (!key) {
        return;
      }
      element.setAttribute("placeholder", t(key, element.getAttribute("placeholder") || ""));
    });
  }

  function setLanguage(nextLanguage, options = {}) {
    const normalized = normalizeLanguage(nextLanguage);
    if (normalized === language) {
      if (options.applyImmediately !== false) {
        applyTranslations(document);
      }
      return language;
    }
    language = normalized;
    if (options.applyImmediately !== false) {
      applyTranslations(document);
    }
    listeners.forEach((listener) => {
      try {
        listener(language);
      } catch (error) {
        // Keep i18n listeners isolated from runtime failures.
      }
    });
    return language;
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    t,
    getLanguage,
    setLanguage,
    applyTranslations,
    getSupportedLanguages,
    subscribe,
  };
}
