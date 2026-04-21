import { generatePassword } from '../utils/password-generator.js';

const elements = {
  authSection: document.getElementById('authSection'),
  vaultSection: document.getElementById('vaultSection'),
  authTitle: document.getElementById('authTitle'),
  authHint: document.getElementById('authHint'),
  masterPassword: document.getElementById('masterPassword'),
  authButton: document.getElementById('authButton'),
  lockButton: document.getElementById('lockButton'),
  siteUrl: document.getElementById('siteUrl'),
  siteUsername: document.getElementById('siteUsername'),
  sitePassword: document.getElementById('sitePassword'),
  siteCategory: document.getElementById('siteCategory'),
  saveCredentialButton: document.getElementById('saveCredentialButton'),
  generateButton: document.getElementById('generateButton'),
  credentialList: document.getElementById('credentialList'),
  searchInput: document.getElementById('searchInput'),
  autofillButton: document.getElementById('autofillButton'),
  openOptions: document.getElementById('openOptions')
};

let credentialsCache = [];
let editingCredentialId = null;

function normalizeUrl(url) {
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    return `https://${url}`;
  }
  return url;
}

async function send(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (response?.error) {
    throw new Error(response.error);
  }
  return response;
}

async function refreshCredentials() {
  const response = await send('vault:list');
  credentialsCache = response.credentials || [];
  renderCredentials(elements.searchInput.value);
}

function createCredentialListItem(item) {
  const li = document.createElement('li');
  const domain = document.createElement('div');
  const domainStrong = document.createElement('strong');
  domainStrong.textContent = item.domain || 'unknown';
  domain.appendChild(domainStrong);

  const username = document.createElement('div');
  username.className = 'small';
  username.textContent = item.username || '';

  const category = document.createElement('div');
  category.className = 'small';
  category.textContent = item.category || 'uncategorized';

  const row = document.createElement('div');
  row.className = 'row';

  const copyButton = document.createElement('button');
  copyButton.className = 'ghost';
  copyButton.setAttribute('data-copy', item.id);
  copyButton.textContent = 'Copy Password';

  const editButton = document.createElement('button');
  editButton.className = 'ghost';
  editButton.setAttribute('data-edit', item.id);
  editButton.textContent = 'Edit';

  const deleteButton = document.createElement('button');
  deleteButton.setAttribute('data-delete', item.id);
  deleteButton.textContent = 'Delete';

  row.append(copyButton, editButton, deleteButton);
  li.append(domain, username, category, row);
  return li;
}

function renderCredentials(searchText = '') {
  const query = searchText.toLowerCase().trim();
  const filtered = credentialsCache.filter((item) => {
    const bag = `${item.domain} ${item.username} ${item.category || ''}`.toLowerCase();
    return !query || bag.includes(query);
  });

  elements.credentialList.innerHTML = '';
  for (const item of filtered) {
    elements.credentialList.appendChild(createCredentialListItem(item));
  }
}

async function copyWithAutoClear(value) {
  const settings = await send('settings:get');
  await navigator.clipboard.writeText(value);
  setTimeout(async () => {
    const current = await navigator.clipboard.readText().catch(() => '');
    if (current === value) {
      await navigator.clipboard.writeText('');
    }
  }, settings.clipboardTimeoutSeconds * 1000);
}

async function showUnlocked() {
  const settings = await send('settings:get');
  document.documentElement.style.colorScheme = settings.darkMode ? 'dark' : 'light';
  elements.authSection.classList.add('hidden');
  elements.vaultSection.classList.remove('hidden');
  await refreshCredentials();
}

function showAuth(configured) {
  elements.vaultSection.classList.add('hidden');
  elements.authSection.classList.remove('hidden');
  elements.authTitle.textContent = configured ? 'Unlock vault' : 'Create master password';
  elements.authButton.textContent = configured ? 'Unlock' : 'Create Vault';
  elements.authHint.textContent = configured ? '' : 'Use a long passphrase. This key encrypts all your data locally.';
}

async function initialize() {
  const init = await send('vault:init');
  const status = await send('vault:status');
  if (status.unlocked) {
    await showUnlocked();
  } else {
    showAuth(init.configured);
  }
}

elements.authButton.addEventListener('click', async () => {
  const password = elements.masterPassword.value;
  if (!password || password.length < 10) {
    elements.authHint.textContent = 'Master password must be at least 10 characters.';
    return;
  }

  const init = await send('vault:init');
  if (init.configured) {
    await send('vault:unlock', { masterPassword: password });
  } else {
    await send('vault:setup', { masterPassword: password });
  }

  elements.masterPassword.value = '';
  elements.authHint.textContent = '';
  await showUnlocked();
});

elements.saveCredentialButton.addEventListener('click', async () => {
  const credential = {
    id: editingCredentialId || undefined,
    url: normalizeUrl(elements.siteUrl.value),
    username: elements.siteUsername.value,
    password: elements.sitePassword.value,
    category: elements.siteCategory.value
  };

  if (!credential.url || !credential.username || !credential.password) {
    return;
  }

  await send('vault:saveCredential', { credential });
  elements.siteUsername.value = '';
  elements.sitePassword.value = '';
  elements.siteCategory.value = '';
  editingCredentialId = null;
  elements.saveCredentialButton.textContent = 'Save';
  await refreshCredentials();
});

elements.generateButton.addEventListener('click', async () => {
  const generated = generatePassword({ length: 22, includeSymbols: true });
  elements.sitePassword.value = generated;
  await copyWithAutoClear(generated);
});

elements.credentialList.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const deleteId = target.getAttribute('data-delete');
  if (deleteId) {
    await send('vault:deleteCredential', { id: deleteId });
    await refreshCredentials();
  }

  const copyId = target.getAttribute('data-copy');
  if (copyId) {
    const credential = credentialsCache.find((item) => item.id === copyId);
    if (credential) {
      await copyWithAutoClear(credential.password);
    }
  }

  const editId = target.getAttribute('data-edit');
  if (editId) {
    const credential = credentialsCache.find((item) => item.id === editId);
    if (credential) {
      editingCredentialId = credential.id;
      elements.siteUrl.value = credential.url || credential.domain || '';
      elements.siteUsername.value = credential.username || '';
      elements.sitePassword.value = credential.password || '';
      elements.siteCategory.value = credential.category || '';
      elements.saveCredentialButton.textContent = 'Update';
    }
  }
});

elements.searchInput.addEventListener('input', () => {
  renderCredentials(elements.searchInput.value);
});

elements.autofillButton.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    await chrome.tabs.sendMessage(tab.id, { type: 'autofill:trigger' });
  }
});

elements.openOptions.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

elements.lockButton.addEventListener('click', async () => {
  await send('vault:lock');
  const init = await send('vault:init');
  showAuth(init.configured);
});

initialize().catch((error) => {
  elements.authHint.textContent = error.message;
});
