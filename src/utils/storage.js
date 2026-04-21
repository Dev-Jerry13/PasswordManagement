const STORAGE_KEYS = {
  vaultState: 'vault_state',
  vaultBlob: 'vault_blob',
  settings: 'vault_settings'
};

const defaultSettings = {
  sessionTimeoutMinutes: 10,
  clipboardTimeoutSeconds: 20,
  darkMode: true,
  biometricEnabled: false,
  phishingProtection: true
};

export async function getStorageValue(key) {
  const raw = await chrome.storage.local.get(key);
  return raw[key];
}

export async function setStorageValue(values) {
  await chrome.storage.local.set(values);
}

export async function loadVaultState() {
  return (await getStorageValue(STORAGE_KEYS.vaultState)) || null;
}

export async function saveVaultState(state) {
  await setStorageValue({ [STORAGE_KEYS.vaultState]: state });
}

export async function loadVaultBlob() {
  return (await getStorageValue(STORAGE_KEYS.vaultBlob)) || null;
}

export async function saveVaultBlob(blob) {
  await setStorageValue({ [STORAGE_KEYS.vaultBlob]: blob });
}

export async function loadSettings() {
  const current = await getStorageValue(STORAGE_KEYS.settings);
  return { ...defaultSettings, ...(current || {}) };
}

export async function saveSettings(settingsPatch) {
  const current = await loadSettings();
  const next = { ...current, ...settingsPatch };
  await setStorageValue({ [STORAGE_KEYS.settings]: next });
  return next;
}

export { STORAGE_KEYS, defaultSettings };
