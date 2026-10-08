const magic = new TextEncoder().encode('MEGUMI01');

export async function decryptModel(data, config) {
  if (!globalThis.crypto?.subtle) throw new Error('Model decryption requires HTTPS.');
  if (config.version !== 1 || config.algorithm !== 'AES-GCM') throw new Error('Unsupported display encoding.');
  const bytes = new Uint8Array(data);
  if (bytes.length < 48 || bytes.length !== config.bytes || !magic.every((value, index) => bytes[index] === value)) {
    throw new Error('Invalid encrypted display file.');
  }
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  if (sha256 !== config.sha256) throw new Error('Encrypted display checksum mismatch.');
  const rawKey = Uint8Array.from(atob(config.key), character => character.charCodeAt(0));
  if (rawKey.length !== 32) throw new Error('Invalid display key.');
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({
    name: 'AES-GCM', iv: bytes.subarray(8, 20), additionalData: magic, tagLength: 128
  }, key, bytes.subarray(20));
  const view = new DataView(plaintext);
  if (plaintext.byteLength < 12 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== plaintext.byteLength) {
    throw new Error('Invalid decrypted display model.');
  }
  return plaintext;
}

export async function loadEncryptedModel(config, onProgress) {
  const url = new URL(config.url, location.href);
  if (url.origin !== location.origin || !/^\/asset\/sumi-display\.[a-f0-9]{16}\.enc$/.test(url.pathname)) {
    throw new Error('Invalid encrypted model URL.');
  }
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok || !response.body) throw new Error('Encrypted model unavailable.');
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      loaded += value.byteLength;
      if (loaded > config.bytes || loaded > 45 * 1024 * 1024) throw new Error('Encrypted model exceeds expected size.');
      chunks.push(value);
      onProgress?.({ loaded, total: config.bytes });
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return decryptModel(bytes, config);
}
