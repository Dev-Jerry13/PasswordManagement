(() => {
  const LOGIN_SELECTORS = [
    'input[type="password"]',
    'input[autocomplete="current-password"]',
    'input[name*="pass" i]'
  ];

  function detectLoginForm() {
    const passwordField = document.querySelector(LOGIN_SELECTORS.join(','));
    if (!passwordField) {
      return null;
    }

    const form = passwordField.closest('form') || document;
    const usernameField =
      form.querySelector('input[type="email"], input[autocomplete="username"], input[name*="user" i], input[name*="email" i], input[type="text"]') || null;

    return { form, usernameField, passwordField };
  }

  async function requestCredential() {
    return chrome.runtime.sendMessage({ type: 'vault:getForUrl', url: window.location.href });
  }

  function fillCredential(target, credential) {
    if (!target || !credential) {
      return;
    }

    const { usernameField, passwordField } = target;
    if (usernameField && credential.username) {
      usernameField.focus();
      usernameField.value = credential.username;
      usernameField.dispatchEvent(new Event('input', { bubbles: true }));
      usernameField.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (passwordField && credential.password) {
      passwordField.focus();
      passwordField.value = credential.password;
      passwordField.dispatchEvent(new Event('input', { bubbles: true }));
      passwordField.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  async function attemptAutofill() {
    const loginForm = detectLoginForm();
    if (!loginForm) {
      return;
    }

    const response = await requestCredential();
    if (response?.error || !response?.credential) {
      return;
    }

    if (response.phishingSafe === false) {
      console.warn('FortiVault blocked autofill due to possible domain mismatch.');
      return;
    }

    fillCredential(loginForm, response.credential);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'autofill:trigger') {
      attemptAutofill()
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ error: error.message }));
      return true;
    }
    return false;
  });

  window.addEventListener('load', () => {
    attemptAutofill().catch(() => {
      /* silently ignore locked vault / missing credentials */
    });
  });
})();
