import { deriveAesKey, decryptJson, encryptJson, fromBase64, passwordVerifier, randomBytes, toBase64 } from '../utils/crypto.js';
import { loadSettings, loadVaultBlob, loadVaultState, saveSettings, saveVaultBlob, saveVaultState } from '../utils/storage.js';

let session = {
  unlocked: false,
  key: null,
  lastActivity: 0
};

const ALARM_NAME = 'vault-session-check';

function now() {
  return Date.now();
}

async function withVaultKey() {
  if (!session.unlocked || !session.key) {
    throw new Error('Vault is locked');
  }

  const settings = await loadSettings();
  const maxAge = settings.sessionTimeoutMinutes * 60 * 1000;
  if (now() - session.lastActivity > maxAge) {
    lockVault();
    throw new Error('Session expired');
  }

  session.lastActivity = now();
  return session.key;
}

function lockVault() {
  session = { unlocked: false, key: null, lastActivity: 0 };
}

async function getVaultData() {
  const key = await withVaultKey();
  const blob = await loadVaultBlob();
  if (!blob) {
    return { credentials: [], updatedAt: new Date().toISOString() };
  }

  return decryptJson(key, blob);
}

async function saveVaultData(vaultData) {
  const key = await withVaultKey();
  const encrypted = await encryptJson(key, vaultData);
  await saveVaultBlob(encrypted);
}

function normalizeDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function findCredentialForUrl(credentials, url) {
  const domain = normalizeDomain(url);
  return credentials.find((item) => item.domain === domain) || null;
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME || !session.unlocked) {
    return;
  }

  const settings = await loadSettings();
  const maxAge = settings.sessionTimeoutMinutes * 60 * 1000;
  if (now() - session.lastActivity > maxAge) {
    lockVault();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case 'vault:init': {
        const state = await loadVaultState();
        sendResponse({ configured: Boolean(state) });
        break;
      }

      case 'vault:setup': {
        const state = await loadVaultState();
        if (state) {
          throw new Error('Master password is already configured');
        }

        const salt = randomBytes(16);
        const key = await deriveAesKey(message.masterPassword, salt);
        const verifier = await passwordVerifier(message.masterPassword, salt);
        const initialVault = { credentials: [], updatedAt: new Date().toISOString() };
        const encrypted = await encryptJson(key, initialVault);

        await saveVaultState({ salt: toBase64(salt), verifier, createdAt: new Date().toISOString() });
        await saveVaultBlob(encrypted);
        session = { unlocked: true, key, lastActivity: now() };
        sendResponse({ success: true });
        break;
      }

      case 'vault:unlock': {
        const state = await loadVaultState();
        if (!state) {
          throw new Error('Vault is not initialized');
        }

        const salt = fromBase64(state.salt);
        const verifier = await passwordVerifier(message.masterPassword, salt);
        if (verifier !== state.verifier) {
          throw new Error('Invalid master password');
        }

        const key = await deriveAesKey(message.masterPassword, salt);
        const blob = await loadVaultBlob();
        if (blob) {
          await decryptJson(key, blob);
        }
        session = { unlocked: true, key, lastActivity: now() };
        sendResponse({ success: true });
        break;
      }

      case 'vault:lock': {
        lockVault();
        sendResponse({ success: true });
        break;
      }

      case 'vault:status': {
        sendResponse({ unlocked: session.unlocked });
        break;
      }

      case 'vault:list': {
        const vault = await getVaultData();
        sendResponse({ credentials: vault.credentials });
        break;
      }

      case 'vault:saveCredential': {
        const vault = await getVaultData();
        const credential = {
          ...message.credential,
          id: message.credential.id || crypto.randomUUID(),
          domain: normalizeDomain(message.credential.url || message.credential.domain || ''),
          updatedAt: new Date().toISOString()
        };

        const nextCredentials = vault.credentials.filter((item) => item.id !== credential.id);
        nextCredentials.push(credential);

        await saveVaultData({ credentials: nextCredentials, updatedAt: new Date().toISOString() });
        sendResponse({ success: true, credential });
        break;
      }

      case 'vault:deleteCredential': {
        const vault = await getVaultData();
        const next = vault.credentials.filter((item) => item.id !== message.id);
        await saveVaultData({ credentials: next, updatedAt: new Date().toISOString() });
        sendResponse({ success: true });
        break;
      }

      case 'vault:getForUrl': {
        const vault = await getVaultData();
        const credential = findCredentialForUrl(vault.credentials, message.url);
        const settings = await loadSettings();
        const phishingSafe = settings.phishingProtection
          ? credential
            ? credential.domain === normalizeDomain(message.url)
            : true
          : true;
        sendResponse({ credential, phishingSafe });
        break;
      }

      case 'settings:get': {
        sendResponse(await loadSettings());
        break;
      }

      case 'settings:update': {
        const updated = await saveSettings(message.patch || {});
        sendResponse(updated);
        break;
      }

      default:
        sendResponse({ error: `Unknown message type: ${message.type}` });
    }
  })().catch((error) => {
    sendResponse({ error: error.message || 'Unexpected error' });
  });

  return true;
});
