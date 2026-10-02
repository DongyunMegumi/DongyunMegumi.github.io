const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { encryptModel } = require('./encrypt-model.cjs');

async function main() {
  const { decryptModel, loadEncryptedModel } = await import(pathToFileURL(path.resolve(__dirname, '../preview/portfolio-case/model-crypto.js')));
  const json = Buffer.from('{"asset":{"version":"2.0"},"scenes":[{}],"scene":0}');
  const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const header = Buffer.alloc(20);
  header.write('glTF'); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + padded.length, 8);
  header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const original = Buffer.concat([header, padded]);
  const { encrypted, config } = encryptModel(original);
  const decode = (bytes, settings = config) => decryptModel(Uint8Array.from(bytes), settings);
  assert.equal(encrypted.length, original.length + 36);
  assert.notEqual(encrypted.toString('ascii', 0, 4), 'glTF');
  assert.deepEqual(Buffer.from(await decode(encrypted)), original);
  assert.notDeepEqual(encryptModel(original).encrypted, encrypted, 'Encryption must use fresh IV/key material');
  assert.throws(() => encryptModel(Buffer.from('not a GLB')));
  await assert.rejects(decode(encrypted, { ...config, version: 2 }), /Unsupported/);
  await assert.rejects(decode(encrypted, { ...config, algorithm: 'AES-CBC' }), /Unsupported/);
  await assert.rejects(decode(encrypted, { ...config, key: 'AA==' }), /Invalid display key/);
  await assert.rejects(decode(encrypted, { ...config, key: crypto.randomBytes(32).toString('base64') }));
  await assert.rejects(decode(encrypted.subarray(0, encrypted.length - 1)), /Invalid encrypted/);
  const damaged = Buffer.from(encrypted);
  damaged[damaged.length - 1] ^= 1;
  await assert.rejects(decode(damaged), /checksum mismatch/);
  await assert.rejects(decode(damaged, { ...config, sha256: crypto.createHash('sha256').update(damaged).digest('hex') }), { name: 'OperationError' });

  const oldFetch = global.fetch;
  const oldLocation = global.location;
  try {
    global.location = { href: 'https://portfolio.example/models/sumi/', origin: 'https://portfolio.example' };
    let received = 0;
    global.fetch = async () => new Response(encrypted);
    assert.deepEqual(Buffer.from(await loadEncryptedModel(config, progress => { received = progress.loaded; })), original);
    assert.equal(received, encrypted.length);
    await assert.rejects(loadEncryptedModel({ ...config, url: 'https://other.example/asset/model.enc' }), /Invalid encrypted model URL/);
    global.fetch = async () => new Response('Not found', { status: 404 });
    await assert.rejects(loadEncryptedModel(config), /unavailable/);
    global.fetch = async () => new Response(Buffer.concat([encrypted, Buffer.from([0])]));
    await assert.rejects(loadEncryptedModel(config), /exceeds expected size/);
  } finally {
    global.fetch = oldFetch;
    if (oldLocation === undefined) delete global.location;
    else global.location = oldLocation;
  }
  console.log('Passed: Node/browser AES-GCM compatibility, random IV/key, authenticated tamper detection, invalid/truncated files, streaming progress, missing assets, oversized payload and foreign URL rejection.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
