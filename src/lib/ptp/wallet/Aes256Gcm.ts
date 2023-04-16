const { Buffer } = require('buffer');
const crypto = require('crypto-browserify');

const ALGORITHM = 'aes-256-gcm';

export default class Aes256Gcm {
  /**
   * Encrypts text with AES 256 GCM.
   * @param {Buffer} text - Cleartext to encode.
   * @param {Buffer|null} iv - iv
   * @param {Buffer|null} aad - needAad
   * @param {Buffer} secret - Shared secret key, must be 32 bytes.
   * @returns {object}
   */
  static encrypt(
    text: Buffer,
    secret: Buffer,
    iv?: Buffer | null,
    aad?: Buffer | null
  ) {
    const cipher = crypto.createCipheriv(ALGORITHM, secret, iv);
    if (aad) {
      cipher.setAAD(aad);
    }

    let ciphertext = cipher.update(text, 'utf8', 'binary');
    ciphertext += cipher.final('binary');
    const tag = cipher.getAuthTag();
    return Buffer.concat([Buffer.from(tag), Buffer.from(ciphertext, 'binary')]);
  }

  /**
   * Decrypts AES 256 CGM encrypted text.
   * @param {Buffer} cipherData - Base64-encoded ciphertext.
   * @param {Buffer} secret - Shared secret key, must be 32 bytes.
   * @param {Buffer} iv - The base64-encoded initialization vector.
   * @param {Buffer|null} aad - aad.
   * @returns {Buffer}
   */
  static decrypt(
    cipherData: Buffer,
    secret: Buffer,
    iv: Buffer,
    aad?: Buffer | null
  ) {
    const tag = Buffer.from(cipherData.subarray(0, 16));
    const decipher = crypto.createDecipheriv(ALGORITHM, secret, iv);
    let cipherData1: Buffer;
    if (aad) {
      decipher.setAAD(aad);
    }
    cipherData1 = Buffer.from(cipherData.subarray(16, cipherData.length));

    decipher.setAuthTag(tag);
    let plainData = decipher.update(cipherData1.toString('hex'), 'hex', 'hex');
    plainData += decipher.final('hex');
    return Buffer.from(plainData, 'hex');
  }
}
