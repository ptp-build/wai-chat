import assert from 'assert';
import BN from 'bn.js';

const { Buffer } = require('buffer');
const {
  keccak224,
  keccak384,
  keccak256,
  keccak512,
} = require('ethereum-cryptography/keccak');
const {
  ecdsaRecover,
  publicKeyConvert,
  ecdsaSign,
} = require('ethereum-cryptography/secp256k1');

export type BNLike = BN | PrefixedHexString | number | Buffer;
export type PrefixedHexString = string;

export interface ECDSASignature {
  v: number;
  r: Buffer;
  s: Buffer;
}

export interface ECDSASignatureBuffer {
  v: Buffer;
  r: Buffer;
  s: Buffer;
}

const ETH_Signed_Message = '\u0019Ethereum Signed Message:\n';
const PTP_Signed_Message = '\u0019PTP Signed Message:\n';
const PTP_GROUP_Signed_Message = '\u0019PTP GROUP Signed Message:\n';


export enum SignMsgType {
  SignMsgType_eth = 1000,
  SignMsgType_ptp = 1001,
  SignMsgType_ptp_group = 1002,
}

/**
 * Throws if input is not a buffer
 * @param {Buffer} input value to check
 */
export const assertIsBuffer = function (input: Buffer): void {
  if (!Buffer.isBuffer(input)) {
    const msg = `This method only supports Buffer but input was: ${input}`;
    throw new Error(msg);
  }
};
/**
 * Converts a `Buffer` into a `0x`-prefixed hex `String`.
 * @param buf `Buffer` object to convert
 */
export const bufferToHex = function (buf: Buffer): string {
  return '0x' + buf.toString('hex');
};

/**
 * Creates Keccak hash of a Buffer input
 * @param a The input data (Buffer)
 * @param bits (number = 256) The Keccak width
 */
export const keccak = function (a: Buffer, bits: number = 256): Buffer {
  assertIsBuffer(a);
  switch (bits) {
    case 224: {
      return keccak224(a);
    }
    case 256: {
      return keccak256(a);
    }
    case 384: {
      return keccak384(a);
    }
    case 512: {
      return keccak512(a);
    }
    default: {
      throw new Error(`Invald algorithm: keccak${bits}`);
    }
  }
};

/**
 * Converts a `Buffer` to a `Number`.
 * @param buf `Buffer` object to convert
 * @throws If the input number exceeds 53 bits.
 */
export const bufferToInt = function (buf: Buffer): number {
  return new BN(buf).toNumber();
};

/**
 * Interprets a `Buffer` as a signed integer and returns a `BN`. Assumes 256-bit numbers.
 * @param num Signed integer value
 */
export const fromSigned = function (num: Buffer): BN {
  return new BN(num).fromTwos(256);
};

/**
 * Converts a `BN` to an unsigned integer and returns it as a `Buffer`. Assumes 256-bit numbers.
 * @param num
 */
export const toUnsigned = function (num: BN): Buffer {
  return Buffer.from(num.toTwos(256).toArray());
};

/**
 * Converts a `Number` into a hex `String`
 * @param {Number} i
 * @return {String}
 */
export const intToHex = function (i: number) {
  if (!Number.isSafeInteger(i) || i < 0) {
    throw new Error(`Received an invalid integer type: ${i}`);
  }
  return `0x${i.toString(16)}`;
};

/**
 * Adds "0x" to a given `String` if it does not already start with "0x".
 */
export const addHexPrefix = function (str: string): string {
  if (typeof str !== 'string') {
    return str;
  }

  return isHexPrefixed(str) ? str : '0x' + str;
};

/**
 * Returns a `Boolean` on whether or not the a `String` starts with '0x'
 * @param str the string input value
 * @return a boolean if it is or is not hex prefixed
 * @throws if the str input is not a string
 */
export function isHexPrefixed(str: string): boolean {
  if (typeof str !== 'string') {
    throw new Error(
      `[isHexPrefixed] input must be type 'string', received type ${typeof str}`
    );
  }

  return str[0] === '0' && str[1] === 'x';
}

/**
 * Removes '0x' from a given `String` if present
 * @param str the string value
 * @returns the string without 0x prefix
 */
export const stripHexPrefix = (str: string): string => {
  if (typeof str !== 'string')
    throw new Error(
      `[stripHexPrefix] input must be type 'string', received ${typeof str}`
    );

  return isHexPrefixed(str) ? str.slice(2) : str;
};

/**
 * Pads a `String` to have an even length
 * @param value
 * @return output
 */
export function padToEven(value: string): string {
  let a = value;

  if (typeof a !== 'string') {
    throw new Error(
      `[padToEven] value must be type 'string', received ${typeof a}`
    );
  }

  if (a.length % 2) a = `0${a}`;

  return a;
}
//
// function padWithZeroes(number: string, length: number) {
//   let myString = `${number}`;
//   while (myString.length < length) {
//     myString = `0${myString}`;
//   }
//   return myString;
// }
//
// function concatSig(v: Buffer, r: Buffer, s: Buffer) {
//   const rSig = fromSigned(r);
//   const sSig = fromSigned(s);
//   const vSig = bufferToInt(v);
//   const rStr = padWithZeroes(toUnsigned(rSig).toString('hex'), 64);
//   const sStr = padWithZeroes(toUnsigned(sSig).toString('hex'), 64);
//   const vStr = stripHexPrefix(intToHex(vSig));
//   return addHexPrefix(rStr.concat(sStr, vStr));
// }

function getPublicKeyFor(msgData: Buffer, signature: Buffer) {
  const msgHash = keccak(msgData);
  // console.debug("getPublicKeyFor", {msgHash})
  // console.debug("msg_hash_hex", bufferToHex(msgHash))
  const sigParams = fromRpcSig(signature);
  return ecrecover(msgHash, sigParams.v, sigParams.r, sigParams.s);
}

function getPublicKey65For(msgData: Buffer, signature: Buffer) {
  const msgHash = keccak(msgData);
  // console.debug("getPublicKeyFor", {msgHash})
  // console.debug("msg_hash_hex", bufferToHex(msgHash))
  const sigParams = fromRpcSig(signature);
  return ecrecoverPubKey65(msgHash, sigParams.v, sigParams.r, sigParams.s);
}
/**
 * Left Pads a `Buffer` with leading zeros till it has `length` bytes.
 * Or it truncates the beginning if it exceeds.
 * @param msg the value to pad (Buffer)
 * @param length the number of bytes the output should be
 * @return (Buffer)
 */
export const setLengthLeft = function (msg: Buffer, length: number) {
  assertIsBuffer(msg);
  return setLength(msg, length, false);
};

/**
 * Right Pads a `Buffer` with trailing zeros till it has `length` bytes.
 * it truncates the end if it exceeds.
 * @param msg the value to pad (Buffer)
 * @param length the number of bytes the output should be
 * @return (Buffer)
 */
export const setLengthRight = function (msg: Buffer, length: number) {
  assertIsBuffer(msg);
  return setLength(msg, length, true);
};

/**
 * Returns a buffer filled with 0s.
 * @param bytes the number of bytes the buffer should be
 */
export const zeros = function (bytes: number): Buffer {
  return Buffer.allocUnsafe(bytes).fill(0);
};

/**
 * Pads a `Buffer` with zeros till it has `length` bytes.
 * Truncates the beginning or end of input if its length exceeds `length`.
 * @param msg the value to pad (Buffer)
 * @param length the number of bytes the output should be
 * @param right whether to start padding form the left or right
 * @return (Buffer)
 */
const setLength = function (msg: Buffer, length: number, right: boolean) {
  const buf = zeros(length);
  if (right) {
    if (msg.length < length) {
      msg.copy(buf);
      return buf;
    }
    return msg.slice(0, length);
  } else {
    if (msg.length < length) {
      msg.copy(buf, length - msg.length);
      return buf;
    }
    return msg.slice(-length);
  }
};
/**
 * ECDSA public key recovery from signature.
 * NOTE: Accepts `v == 0 | v == 1` for EIP1559 transactions
 * @returns Recovered public key
 */
export const ecrecover = function (
  msgHash: Buffer,
  v: BNLike,
  r: Buffer,
  s: Buffer,
  chainId?: BNLike
): Buffer {
  const signature = Buffer.concat(
    [setLengthLeft(r, 32), setLengthLeft(s, 32)],
    64
  );
  const recovery = calculateSigRecovery(v, chainId);
  if (!isValidSigRecovery(recovery)) {
    throw new Error('Invalid signature v value');
  }
  const senderPubKey = ecdsaRecover(signature, recovery.toNumber(), msgHash);
  return Buffer.from(publicKeyConvert(senderPubKey, false).slice(1));
};

/**
 * ECDSA public key recovery from signature.
 * NOTE: Accepts `v == 0 | v == 1` for EIP1559 transactions
 * @returns Recovered public key
 */
export const ecrecoverPubKey65 = function (
  msgHash: Buffer,
  v: BNLike,
  r: Buffer,
  s: Buffer,
  chainId?: BNLike
): Uint8Array {
  const signature = Buffer.concat(
    [setLengthLeft(r, 32), setLengthLeft(s, 32)],
    64
  );
  const recovery = calculateSigRecovery(v, chainId);
  if (!isValidSigRecovery(recovery)) {
    throw new Error('Invalid signature v value');
  }
  const senderPubKey = ecdsaRecover(signature, recovery.toNumber(), msgHash);
  return publicKeyConvert(senderPubKey, false);
};

/**
 * Type output options
 */
export enum TypeOutput {
  Number,
  BN,
  Buffer,
  PrefixedHexString,
}

function isValidSigRecovery(recovery: number | BN): boolean {
  const rec = new BN(recovery);
  return rec.eqn(0) || rec.eqn(1);
}

/*
 * A type that represents an object that has a `toArray()` method.
 */
export interface TransformableToArray {
  toArray(): Uint8Array;

  toBuffer?(): Buffer;
}

/*
 * A type that represents an object that has a `toBuffer()` method.
 */
export interface TransformableToBuffer {
  toBuffer(): Buffer;

  toArray?(): Uint8Array;
}

export type ToBufferInputTypes =
  | PrefixedHexString
  | number
  | BN
  | Buffer
  | Uint8Array
  | number[]
  | TransformableToArray
  | TransformableToBuffer
  | null
  | undefined;

export type TypeOutputReturnType = {
  [TypeOutput.Number]: number;
  [TypeOutput.BN]: BN;
  [TypeOutput.Buffer]: Buffer;
  [TypeOutput.PrefixedHexString]: PrefixedHexString;
};

/**
 * Converts an `Number` to a `Buffer`
 * @param {Number} i
 * @return {Buffer}
 */
export const intToBuffer = function (i: number) {
  const hex = intToHex(i);
  return Buffer.from(padToEven(hex.slice(2)), 'hex');
};
/**
 * Attempts to turn a value into a `Buffer`.
 * Inputs supported: `Buffer`, `String` (hex-prefixed), `Number`, null/undefined, `BN` and other objects
 * with a `toArray()` or `toBuffer()` method.
 * @param v the value
 */
export const toBuffer = function (v: ToBufferInputTypes): Buffer {
  if (v === null || v === undefined) {
    return Buffer.allocUnsafe(0);
  }

  if (Buffer.isBuffer(v)) {
    return Buffer.from(v);
  }

  if (Array.isArray(v) || v instanceof Uint8Array) {
    return Buffer.from(v as Uint8Array);
  }

  if (typeof v === 'string') {
    if (!isHexString(v)) {
      throw new Error(
        `Cannot convert string to buffer. toBuffer only supports 0x-prefixed hex strings and this string was given: ${v}`
      );
    }
    return Buffer.from(padToEven(stripHexPrefix(v)), 'hex');
  }

  if (typeof v === 'number') {
    return intToBuffer(v);
  }

  if (BN.isBN(v)) {
    if (v.isNeg()) {
      throw new Error(`Cannot convert negative BN to buffer. Given: ${v}`);
    }
    return v.toArrayLike(Buffer);
  }

  if (v.toArray) {
    // converts a BN to a Buffer
    return Buffer.from(v.toArray());
  }

  if (v.toBuffer) {
    return Buffer.from(v.toBuffer());
  }

  throw new Error('invalid type');
};

/**
 * Is the string a hex string.
 *
 * @param  value
 * @param  length
 * @returns  output the string is a hex string
 */
export function isHexString(value: string, length?: number): boolean {
  if (typeof value !== 'string' || !value.match(/^0x[0-9A-Fa-f]*$/))
    return false;

  if (length && value.length !== 2 + 2 * length) return false;

  return true;
}

/**
 * Convert an input to a specified type.
 * Input of null/undefined returns null/undefined regardless of the output type.
 * @param input value to convert
 * @param outputType type to output
 */
export function toType<T extends TypeOutput>(input: null, outputType: T): null;
// eslint-disable-next-line no-redeclare
export function toType<T extends TypeOutput>(
  input: undefined,
  outputType: T
): undefined;
// eslint-disable-next-line no-redeclare
export function toType<T extends TypeOutput>(
  input: ToBufferInputTypes,
  outputType: T
): TypeOutputReturnType[T];
// eslint-disable-next-line no-redeclare
export function toType<T extends TypeOutput>(
  input: ToBufferInputTypes,
  outputType: T
): TypeOutputReturnType[T] | undefined | null {
  if (input === null) {
    return null;
  }
  if (input === undefined) {
    return undefined;
  }

  if (typeof input === 'string' && !isHexString(input)) {
    throw new Error(
      `A string must be provided with a 0x-prefix, given: ${input}`
    );
  } else if (typeof input === 'number' && !Number.isSafeInteger(input)) {
    throw new Error(
      'The provided number is greater than MAX_SAFE_INTEGER (please use an alternative input type)'
    );
  }

  const output = toBuffer(input);

  if (outputType === TypeOutput.Buffer) {
    return output as TypeOutputReturnType[T];
  } else if (outputType === TypeOutput.BN) {
    return new BN(output) as TypeOutputReturnType[T];
  } else if (outputType === TypeOutput.Number) {
    const bn = new BN(output);
    const max = new BN(Number.MAX_SAFE_INTEGER.toString());
    if (bn.gt(max)) {
      throw new Error(
        'The provided number is greater than MAX_SAFE_INTEGER (please use an alternative output type)'
      );
    }
    return bn.toNumber() as TypeOutputReturnType[T];
  } else {
    // outputType === TypeOutput.PrefixedHexString
    return `0x${output.toString('hex')}` as TypeOutputReturnType[T];
  }
}

function calculateSigRecovery(v: BNLike, chainId?: BNLike): BN {
  const vBN = toType(v, TypeOutput.BN);

  if (vBN.eqn(0) || vBN.eqn(1)) return toType(v, TypeOutput.BN);

  if (!chainId) {
    return vBN.subn(27);
  }
  const chainIdBN = toType(chainId, TypeOutput.BN);
  return vBN.sub(chainIdBN.muln(2).addn(35));
}

/**
 * Convert signature format of the `eth_sign` RPC method to signature parameters
 * NOTE: all because of a bug in geth: https://github.com/ethereum/go-ethereum/issues/2053
 * NOTE: After EIP1559, `v` could be `0` or `1` but this function assumes
 * it's a signed message (EIP-191 or EIP-712) adding `27` at the end. Remove if needed.
 */
export const fromRpcSig = function (buf: Buffer): ECDSASignature {
  let r: Buffer;
  let s: Buffer;
  let v: number;
  if (buf.length >= 65) {
    r = buf.slice(0, 32);
    s = buf.slice(32, 64);
    v = bufferToInt(buf.slice(64));
  } else if (buf.length === 64) {
    // Compact Signature Representation (https://eips.ethereum.org/EIPS/eip-2098)
    r = buf.slice(0, 32);
    s = buf.slice(32, 64);
    v = bufferToInt(buf.slice(32, 33)) >> 7;
    s[0] &= 0x7f;
  } else {
    throw new Error('Invalid signature length');
  }

  // support both versions of `eth_sign` responses
  if (v < 27) {
    v += 27;
  }

  return {
    v,
    r,
    s,
  };
};

/**
 * Returns the ethereum address of a given public key.
 * Accepts "Ethereum public keys" and SEC1 encoded keys.
 * @param pubKey The two points of an uncompressed key, unless sanitize is enabled
 * @param sanitize Accept public keys in other formats
 */
export const pubToAddress = function (
  pubKey: Buffer,
  sanitize: boolean = false
): Buffer {
  assertIsBuffer(pubKey);
  if (sanitize && pubKey.length !== 64) {
    pubKey = Buffer.from(publicKeyConvert(pubKey, false).slice(1));
  }
  assert(pubKey.length === 64);
  // Only take the lower 160bits of the hash
  const hash = keccak(pubKey);
  // console.debug('pubToAddress keccak(pubKey)', hash.length, hash);
  return hash.slice(-20);
};
export const publicToAddress = pubToAddress;

export function ecsign(
  msgHash: Buffer,
  privateKey: Buffer,
  chainId?: any
): any {
  const { signature, recid } = ecdsaSign(msgHash, privateKey, {
    recovered: true,
  });
  const r = Buffer.from(signature.slice(0, 32));
  const s = Buffer.from(signature.slice(32, 64));

  if (!chainId || typeof chainId === 'number') {
    // return legacy type ECDSASignature (deprecated in favor of ECDSASignatureBuffer to handle large chainIds)
    if (chainId && !Number.isSafeInteger(chainId)) {
      throw new Error(
        'The provided number is greater than MAX_SAFE_INTEGER (please use an alternative input type)'
      );
    }
    const v = chainId ? recid + (chainId * 2 + 35) : recid + 27;
    return { r, s, v };
  }
  //@todo
  // const chainIdBN = toType(chainId as BNLike, TypeOutput.BN)
  // const v = chainIdBN.muln(2).addn(35).addn(recovery).toArrayLike(Buffer)
  // return { r, s, v }
}

export default class EcdsaHelper {
  //@ts-ignore
  private pubKey: Buffer | undefined;
  private prvKey: Buffer | undefined;

  constructor({ pubKey, prvKey }: { pubKey: Buffer; prvKey: Buffer }) {
    Object.defineProperty(this, 'pubKey', {
      value: pubKey,
      writable: false,
    });
    Object.defineProperty(this, 'prvKey', {
      value: prvKey,
      writable: false,
    });
  }
  static getSignMsgData(message: string,signMsgType:SignMsgType = SignMsgType.SignMsgType_ptp){
    const data = Buffer.from(message, 'utf-8');
    let prefix;
    if(signMsgType == SignMsgType.SignMsgType_eth){
      prefix = Buffer.from(`${ETH_Signed_Message}${data.length}`, 'utf-8');
    }else if (signMsgType == SignMsgType.SignMsgType_ptp_group){
      prefix = Buffer.from(`${PTP_GROUP_Signed_Message}${data.length}`, 'utf-8');
    }else{
      prefix = Buffer.from(`${PTP_Signed_Message}${data.length}`, 'utf-8');
    }
    //console.log("getSignMsgData",Buffer.concat([prefix, data]).toString())
    return Buffer.concat([prefix, data]);
  }
  sign(message: string) {
    const msgHash = keccak(EcdsaHelper.getSignMsgData(message));
    // console.debug("sign", {msgHash})
    const sig = ecsign(msgHash, this.prvKey!);
    // const serialized = concatSig(sig.v, sig.r, sig.s);
    return Buffer.concat([sig.r, sig.s, intToBuffer(sig.v)]);
  }

  static recoverAddress({ sig, message }: { sig: Buffer; message: string }) {
    const publicKey = getPublicKeyFor(EcdsaHelper.getSignMsgData(message), sig);
    // console.debug('recoverAddress publicKey', publicKey.length, publicKey);
    // console.debug('recoverAddress publicKey hex', bufferToHex(publicKey));
    const sender = publicToAddress(publicKey);
    const senderHex = bufferToHex(sender);
    // console.debug('recoverAddress', sender.length, sender, senderHex);
    return senderHex;
  }

  static recoverAddressAndPubKey({
    sig,
    message,
  }: {
    sig: Buffer;
    message: string;
  }) {
    const publicKey = getPublicKey65For(EcdsaHelper.getSignMsgData(message), sig);
    // console.debug('recoverAddress publicKey', publicKey.length, publicKey);
    // console.debug('recoverAddress publicKey hex', bufferToHex(publicKey));
    const sender = publicToAddress(Buffer.from(publicKey.slice(1)));
    const senderHex = bufferToHex(sender);
    // console.debug('recoverAddress', sender.length, sender, senderHex);
    return { address: senderHex, pubKey: Buffer.from(publicKey) };
  }
}
