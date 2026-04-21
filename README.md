# FortiVault Password Manager Extension

FortiVault is a Manifest V3 browser extension designed for Chromium browsers (Chrome, Edge, Brave, Arc, etc.) with secure local-first password storage, autofill, and vault management.

## Features

- Master password setup and unlock workflow.
- AES-256-GCM encrypted vault stored in `chrome.storage.local`.
- PBKDF2 key derivation (250,000 iterations, SHA-256, per-vault random salt).
- Auto-lock via session timeout in the background service worker.
- Login form detection + secure autofill (automatic and manual trigger).
- Strong password generator with clipboard copy and auto-clear timer.
- Vault dashboard in popup with search, delete, and category metadata.
- Domain-based phishing protection (autofill only when URL hostname matches stored credential domain).
- Options page for security settings.

## Project Structure

```text
manifest.json
src/
  background/
    background.js
  content-scripts/
    content.js
  popup/
    popup.html
    popup.css
    popup.js
  options/
    options.html
    options.css
    options.js
  utils/
    crypto.js
    storage.js
    password-generator.js
```

## How Encryption Works

1. **Master password setup**
   - A 16-byte random salt is generated (`crypto.getRandomValues`).
   - PBKDF2 derives:
     - A verifier hash used to validate login attempts without storing the password.
     - A non-exportable AES-256 key used only in-memory.

2. **Vault encryption**
   - Vault data is serialized to JSON.
   - AES-GCM encrypts with a new random 12-byte IV for each save.
   - Encrypted payload + IV are stored in local extension storage.

3. **Vault decryption**
   - On unlock, entered master password is re-derived with stored salt.
   - Verifier must match before using derived key.
   - Key decrypts vault in-memory; plaintext is never persisted.

4. **Session management**
   - Derived CryptoKey is kept only in the background service worker session.
   - Inactivity timeout (configurable) automatically locks and discards key material.

## Load in Chrome (Developer Mode)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked**.
4. Select this repository folder: `PasswordManagement`.
5. Pin **FortiVault** from the extensions menu.
6. Open popup and create a master password.

## Security Notes

- No plaintext passwords are stored to persistent storage.
- Clipboard copies are auto-cleared after a configurable timeout.
- Autofill uses domain matching to reduce phishing risk.
- Keep host permissions broad for autofill support; reduce `host_permissions` if your deployment only targets specific domains.

## Future Hardening Ideas

- Add full WebAuthn biometric ceremony for second-factor unlock.
- Integrate breach detection (k-anonymity API).
- Add encrypted cloud sync with user-managed key material.
- Add CSP hardening and UI unit/integration tests.
