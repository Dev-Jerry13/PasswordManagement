const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const CryptoConfig = {
  iterations: 250000,
  hash: 'SHA-256',
  keyLength: 256,
  saltLength: 16,
  ivLength: 12
};

export function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function toBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

export function fromBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function deriveAesKey(masterPassword, saltBytes) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(masterPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveKey', 'deriveBits']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: CryptoConfig.iterations,
      hash: CryptoConfig.hash
    },
    keyMaterial,
    { name: 'AES-GCM', length: CryptoConfig.keyLength },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function passwordVerifier(masterPassword, saltBytes) {
  const material = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(masterPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: CryptoConfig.iterations,
      hash: CryptoConfig.hash
    },
    material,
    256
  );

  return toBase64(new Uint8Array(bits));
}

export async function encryptJson(key, value) {
  const iv = randomBytes(CryptoConfig.ivLength);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    textEncoder.encode(JSON.stringify(value))
  );

  return {
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(ciphertext))
  };
}

export async function decryptJson(key, payload) {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: fromBase64(payload.iv)
    },
    key,
    fromBase64(payload.data)
  );

  return JSON.parse(textDecoder.decode(plaintext));
}
