/**
 * ECIES encrypt/decrypt with Ethereum keys
 * Modified from https://github.com/vhpoet/simple-ecies/blob/master/index.js
 */
// @ts-ignore
import { ec as EC } from 'elliptic';
// import Crypto from 'crypto';
const Crypto = require('crypto-browserify')

const { Buffer } = require('buffer');

const ec = new EC('secp256k1');

type Opts = {
  iv?: Buffer;
  ephemPrivKey?: Buffer;
};

/**
 * AES-256 CBC encrypt
 * @param {Buffer} iv
 * @param {Buffer} key
 * @param {Buffer} plaintext
 * @returns {Buffer} ciphertext
 */
const AES256CbcEncrypt = (
  iv: Buffer,
  key: Buffer,
  plaintext: Buffer
): Buffer => {
  const cipher = Crypto.createCipheriv('aes-256-cbc', key, iv);
  const firstChunk = cipher.update(plaintext);
  const secondChunk = cipher.final();
  return Buffer.concat([firstChunk, secondChunk]);
};

/**
 * AES-256 CBC decrypt
 * @param {Buffer} iv
 * @param {Buffer} key
 * @param {Buffer} ciphertext
 * @returns {Buffer} plaintext
 */
const AES256CbcDecrypt = (
  iv: Buffer,
  key: Buffer,
  ciphertext: Buffer
): Buffer => {
  const cipher = Crypto.createDecipheriv('aes-256-cbc', key, iv);
  const firstChunk = cipher.update(ciphertext);
  const secondChunk = cipher.final();
  return Buffer.concat([firstChunk, secondChunk]);
};

/**
 * Compares if two buffers are equal
 * @param {Buffer} b1
 * @param {Buffer} b2
 * @returns {boolean} true if the buffers are equal
 */
const BufferEqual = (b1: Buffer, b2: Buffer): boolean => {
  if (b1.length !== b2.length) {
    return false;
  }
  let res = 0;
  for (let i = 0; i < b1.length; i++) {
    res |= b1[i] ^ b2[i];
  }
  return res === 0;
};

/**
 * ECIES encrypt
 * @param {Buffer} pubKeyTo Ethereum pub key, 64 bytes
 * @param {Buffer} plainBuffer Plaintext to be encrypted
 * @param opts
 * optional iv (16 bytes) and ephem key (32 bytes)
 * @returns {Buffer} Encrypted message, serialized, 113+ bytes
 */
export const encrypt = (
  pubKeyTo: Buffer,
  plainBuffer: Buffer,
  opts: Opts = {}
): Buffer => {
  if (64 !== pubKeyTo.length) {
    throw new Error('pubKeyTo len must 64');
  }
  const prvKey = opts.ephemPrivKey! || Crypto.randomBytes(32);
  const ephemPrivKey = ec.keyFromPrivate(prvKey);
  const ephemPubKey = ephemPrivKey.getPublic();
  const ephemPubKeyEncoded = Buffer.from(ephemPubKey.encode('array', false));

  // Every EC public key begins with the 0x04 prefix before giving
  // the location of the two point on the curve
  const pubKey = Buffer.concat([Buffer.from([0x04]), pubKeyTo]);
  const pubKey1 = ec.keyFromPublic(pubKey);
  const px = ephemPrivKey.derive(pubKey1.getPublic());

  const hash = Crypto.createHash('sha512')
    .update(px.toArrayLike(Buffer))
    .digest();
  const iv = opts.iv || Crypto.randomBytes(16);
  const encryptionKey = hash.slice(0, 32);
  const macKey = hash.slice(32);

  const ciphertext = AES256CbcEncrypt(iv, encryptionKey, plainBuffer);

  const dataToMac = Buffer.concat([iv, ephemPubKeyEncoded, ciphertext]);

  const mac = Crypto.createHmac('sha256', macKey).update(dataToMac).digest();

  return Buffer.concat([
    iv, // 16 bytes
    ephemPubKeyEncoded, // 65 bytes
    mac, // 32 bytes
    ciphertext,
  ]);
};

/**
 * ECIES decrypt
 * @param {Buffer} privKey Ethereum private key, 32 bytes
 * @param {Buffer} encrypted Encrypted message, serialized, 113+ bytes
 * @param opts
 * @returns {Buffer} plaintext
 */
export const decrypt = (
  privKey: Buffer,
  encrypted: Buffer,
  opts: Opts = {}
) => {
  opts = opts || {};
  let ephemPubKeyEncoded;
  let ephemPubKey;
  let offset = 0;
  if (opts.ephemPrivKey) {
    offset = 65;
    const ephemPrivKey = ec.keyFromPrivate(opts.ephemPrivKey);
    ephemPubKey = ephemPrivKey.getPublic();
    ephemPubKeyEncoded = Buffer.from(ephemPubKey.encode('array', false));
  } else {
    ephemPubKeyEncoded = encrypted.slice(16, 81);
    ephemPubKey = ec.keyFromPublic(ephemPubKeyEncoded).getPublic();
  }

  const iv = encrypted.slice(0, 16);
  const mac = encrypted.slice(81 - offset, 113 - offset);
  const ciphertext = encrypted.slice(113 - offset);
  const px = ec.keyFromPrivate(privKey).derive(ephemPubKey);
  const hash = Crypto.createHash('sha512')
    .update(px.toArrayLike(Buffer))
    .digest();
  const encryptionKey = hash.slice(0, 32);
  const macKey = hash.slice(32);
  const dataToMac = Buffer.concat([iv, ephemPubKeyEncoded, ciphertext]);
  const computedMac = Crypto.createHmac('sha256', macKey)
    .update(dataToMac)
    .digest();
  // verify mac
  if (!BufferEqual(computedMac, mac)) {
    throw new Error('MAC mismatch');
  }
  return AES256CbcDecrypt(iv, encryptionKey, ciphertext);
};
