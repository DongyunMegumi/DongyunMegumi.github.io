const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MAGIC = Buffer.from('MEGUMI01');

function encryptModel(bytes) {
  if (bytes.length < 12 || bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error('Expected a complete GLB 2 display export.');
  }
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(MAGIC);
  const encrypted = Buffer.concat([MAGIC, iv, cipher.update(bytes), cipher.final(), cipher.getAuthTag()]);
  const sha256 = crypto.createHash('sha256').update(encrypted).digest('hex');
  return {
    encrypted,
    config: {
      version: 1, algorithm: 'AES-GCM',
      url: `/asset/sumi-display.${sha256.slice(0, 16)}.enc`,
      key: key.toString('base64'), sha256, bytes: encrypted.length
    }
  };
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const source = path.join(root, 'preview/portfolio-case/.local-assets/sumi-display.glb');
  const assets = path.join(root, 'portfolio-assets');
  const { encrypted, config } = encryptModel(fs.readFileSync(source));
  const destination = path.join(assets, config.url.slice(1));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, encrypted);
  // This client key is deliberately public, not a secret or access-control mechanism.
  fs.writeFileSync(path.join(assets, 'model-view.json'), JSON.stringify(config, null, 2) + '\n');
  console.log(`Encrypted display asset: ${path.basename(destination)} (${(encrypted.length / 1024 / 1024).toFixed(2)} MiB)`);
  console.log('Original GLB stays in ignored local assets. Browser decryption is a download deterrent, not extraction protection.');
}

module.exports = { encryptModel };
