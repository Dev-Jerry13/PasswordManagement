const fields = {
  sessionTimeoutMinutes: document.getElementById('sessionTimeoutMinutes'),
  clipboardTimeoutSeconds: document.getElementById('clipboardTimeoutSeconds'),
  phishingProtection: document.getElementById('phishingProtection'),
  darkMode: document.getElementById('darkMode'),
  biometricEnabled: document.getElementById('biometricEnabled'),
  biometricHint: document.getElementById('biometricHint'),
  saveButton: document.getElementById('saveButton'),
  status: document.getElementById('status')
};

async function send(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (response?.error) {
    throw new Error(response.error);
  }
  return response;
}

function biometrySupported() {
  return window.isSecureContext && 'PublicKeyCredential' in window;
}

async function loadSettings() {
  const settings = await send('settings:get');
  fields.sessionTimeoutMinutes.value = settings.sessionTimeoutMinutes;
  fields.clipboardTimeoutSeconds.value = settings.clipboardTimeoutSeconds;
  fields.phishingProtection.checked = settings.phishingProtection;
  fields.darkMode.checked = settings.darkMode;
  fields.biometricEnabled.checked = settings.biometricEnabled;

  fields.biometricHint.textContent = biometrySupported()
    ? 'Platform authenticators detected. You can enable biometric prompts for future unlock workflows.'
    : 'Biometric APIs are unavailable in this browser context.';

  if (!biometrySupported()) {
    fields.biometricEnabled.disabled = true;
  }
}

fields.saveButton.addEventListener('click', async () => {
  const patch = {
    sessionTimeoutMinutes: Number(fields.sessionTimeoutMinutes.value),
    clipboardTimeoutSeconds: Number(fields.clipboardTimeoutSeconds.value),
    phishingProtection: fields.phishingProtection.checked,
    darkMode: fields.darkMode.checked,
    biometricEnabled: fields.biometricEnabled.checked && biometrySupported()
  };

  await send('settings:update', { patch });
  fields.status.textContent = 'Settings saved.';
});

loadSettings().catch((error) => {
  fields.status.textContent = error.message;
});
