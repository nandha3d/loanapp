import {
  createReadStream, createWriteStream, openSync, readSync, closeSync,
  statSync, renameSync, rmSync, readFileSync,
} from 'node:fs';
import {
  randomBytes, createCipheriv, createDecipheriv, publicEncrypt,
  privateDecrypt, constants,
} from 'node:crypto';
import { pipeline } from 'node:stream/promises';

const [mode, keyPath, inputOrOutput, output] = process.argv.slice(2);

if (mode === 'encrypt' && keyPath && inputOrOutput && !output) {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const wrappedKey = publicEncrypt({
    key: readFileSync(keyPath),
    padding: constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256',
  }, key);
  const header = Buffer.from(JSON.stringify({
    version: 1,
    iv: iv.toString('base64'),
    wrappedKey: wrappedKey.toString('base64'),
  }) + '\n');
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const target = createWriteStream(inputOrOutput, { mode: 0o600 });
  target.write(header);
  try {
    await pipeline(process.stdin, cipher, target, { end: false });
    target.end(cipher.getAuthTag());
    await new Promise((resolve, reject) => {
      target.once('finish', resolve);
      target.once('error', reject);
    });
  } catch (error) {
    target.destroy();
    rmSync(inputOrOutput, { force: true });
    throw error;
  }
} else if (mode === 'decrypt' && keyPath && inputOrOutput && output) {
  const fd = openSync(inputOrOutput, 'r');
  const prefix = Buffer.alloc(8192);
  const prefixLength = readSync(fd, prefix, 0, prefix.length, 0);
  const newline = prefix.subarray(0, prefixLength).indexOf(10);
  if (newline < 0) throw new Error('Snapshot header missing');
  const header = JSON.parse(prefix.subarray(0, newline).toString('utf8'));
  if (header.version !== 1) throw new Error('Unsupported snapshot format');
  const size = statSync(inputOrOutput).size;
  const dataStart = newline + 1;
  if (size < dataStart + 16) throw new Error('Snapshot is truncated');
  const tag = Buffer.alloc(16);
  readSync(fd, tag, 0, 16, size - 16);
  closeSync(fd);
  const key = privateDecrypt({
    key: readFileSync(keyPath),
    padding: constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256',
  }, Buffer.from(header.wrappedKey, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(header.iv, 'base64'));
  decipher.setAuthTag(tag);
  const temporary = `${output}.partial`;
  try {
    await pipeline(
      createReadStream(inputOrOutput, { start: dataStart, end: size - 17 }),
      decipher,
      createWriteStream(temporary, { mode: 0o600 }),
    );
    renameSync(temporary, output);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
} else {
  console.error('Usage: snapshot-crypto.mjs encrypt <public-key> <output> | decrypt <private-key> <input> <output>');
  process.exitCode = 2;
}
