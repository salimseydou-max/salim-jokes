export const featureFlags = Object.freeze({
  monetizationEnabled: false,
  premiumFeaturesVisible: false,
  paymentCheckoutEnabled: false,
});

export function getFeatureFlags() {
  return featureFlags;
}

export function isFeatureEnabled(flagName) {
  return Boolean(featureFlags[flagName]);
}
