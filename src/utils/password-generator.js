const CHARSETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?'
};

export function generatePassword({
  length = 20,
  includeUpper = true,
  includeLower = true,
  includeNumbers = true,
  includeSymbols = true
} = {}) {
  const selected = [
    includeUpper ? CHARSETS.upper : '',
    includeLower ? CHARSETS.lower : '',
    includeNumbers ? CHARSETS.numbers : '',
    includeSymbols ? CHARSETS.symbols : ''
  ].filter(Boolean);

  if (!selected.length) {
    throw new Error('At least one character set must be enabled.');
  }
  if (length < selected.length) {
    throw new Error('Length must be at least the number of enabled character sets.');
  }

  const all = selected.join('');
  const bytes = new Uint32Array(length * 2);
  crypto.getRandomValues(bytes);

  const chars = [];

  // Ensure each enabled character set contributes at least one character.
  for (let i = 0; i < selected.length; i += 1) {
    const charset = selected[i];
    chars.push(charset[bytes[i] % charset.length]);
  }

  for (let i = selected.length; i < length; i += 1) {
    chars.push(all[bytes[i] % all.length]);
  }

  // Fisher-Yates shuffle using crypto-random indices.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = bytes[length + i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}
