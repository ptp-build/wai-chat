import EcdsaHelper from '../EcdsaHelper';
import { encrypt, decrypt } from '../EthEcies';
import Mnemonic from '../Mnemonic';
import Wallet from '../Wallet';

const crypto = require('crypto');
const { ecdh } = require('ethereum-cryptography/secp256k1');
const eutil = require('ethereumjs-util');

it('ecdh test', () => {
  let wallet1 = new Wallet(new Mnemonic('扑 厘 赵 缓 逼 龄 余 函 失 吧 算 韩'));
  let wallet2 = new Wallet(
    new Mnemonic(
      'lunch pause flip lizard walnut purse airport host alpha tomato mother absent'
    )
  );
  let key1 = wallet1.getEthWallet(0);
  let key2 = wallet2.getEthWallet(0);
  const share21 = ecdh(key1.pubKey, key2.prvKey);
  const share12 = ecdh(key2.pubKey, key1.prvKey);
  expect(share12).toEqual(share21);
});

it('ecdh test1', () => {
  let wallet1 = new Wallet(
    Mnemonic.fromEntropy('b374a2ee9485f0bdfee53218b4527ace')
  );
  let wallet2 = new Wallet(
    Mnemonic.fromEntropy('9b762a3291903615bbc60e4f98ca7390')
  );
  let key1 = wallet1.getEthWallet(0);
  let key11 = wallet1.getEthWallet(0, true);
  let key2 = wallet2.getEthWallet(0);
  let key21 = wallet2.getEthWallet(0, true);
  console.log(key1.pubKey_, key1.pubKey.length, key1);
  console.log(key11);
  console.log(key2.pubKey_, key2.pubKey.length, key2);
  console.log(key21);
  const share21 = ecdh(key1.pubKey, key2.prvKey);
  const share12 = ecdh(key2.pubKey, key1.prvKey);
  console.log(share12);
  expect(share12).toEqual(share21);
  console.log(Buffer.from(share12).toString('hex'));
  console.log(Buffer.from(share21).toString('hex'));

  const ecdsa = new EcdsaHelper({
    prvKey: key2.prvKey,
    pubKey: key2.pubKey,
  });
  const message = 'abc123';
  const signRes = ecdsa.sign(message);

  const res = EcdsaHelper.recoverAddressAndPubKey({
    message,
    sig: signRes,
  });
  expect(res.address).toBe(key2.address);
  const share121 = ecdh(res.pubKey, key1.prvKey);
  console.log(res.pubKey.toString('hex'));
  console.log(share121);
  expect(share121.toString('hex')).toBe(share12.toString('hex'));
});

it('encrypt|decrypt by wallet', () => {
  let wallet = new Wallet(
    new Mnemonic(
      'lunch pause flip lizard walnut purse airport host alpha tomato mother absent'
    )
  );
  let { prvKey, pubKey_ } = wallet.getEthWallet(0);

  const encrypted = encrypt(pubKey_, Buffer.from('foo'));
  expect(encrypted.length).toBe(129);
  const decrypted = decrypt(prvKey, encrypted);
  expect(decrypted).toEqual(Buffer.from('foo'));
});

it('should encrypt a message without error', () => {
  let prvKey = crypto.randomBytes(32);
  console.debug(prvKey.toString('hex'));
  prvKey = Buffer.from(
    '813f7dc5fd7361b11fa0768541f4e963939673f5dbca59c5df39f2199c81cac5',
    'hex'
  );
  const pubKey = eutil.privateToPublic(prvKey);
  const encrypted = encrypt(pubKey, Buffer.from('foo'));
  expect(encrypted.length).toBe(129);
});

it('should throw an error if priv key is given', () => {
  const privKey = crypto.randomBytes(32);
  expect(() => encrypt(privKey, Buffer.from('foo'))).toThrow(
    'Unknown point format'
  );
});

it('should accept provided IV and ephem key', () => {
  const privKey = crypto.randomBytes(32);
  const pubKey = eutil.privateToPublic(privKey);
  const iv = crypto.randomBytes(16);
  const ephemPrivKey = crypto.randomBytes(32);
  // append 0x04 prefix to the EC key
  const ephemPubKey = Buffer.concat([
    Buffer.from([0x04]),
    eutil.privateToPublic(ephemPrivKey),
  ]);
  const encrypted = encrypt(pubKey, Buffer.from('foo'), {
    iv,
    ephemPrivKey,
  });
  expect(iv).toEqual(encrypted.slice(0, 16));
  expect(ephemPubKey).toEqual(encrypted.slice(16, 81));
});

describe('roundtrip', () => {
  it('should return the same plaintext after roundtrip', () => {
    const plaintext = Buffer.from('spam');
    const privKey = crypto.randomBytes(32);
    const pubKey = eutil.privateToPublic(privKey);
    const encrypted = encrypt(pubKey, plaintext);
    const decrypted = decrypt(privKey, encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should only decrypt if correct priv key is given', () => {
    const plaintext = Buffer.from('spam');
    const privKey = crypto.randomBytes(32);
    const pubKey = eutil.privateToPublic(privKey);
    const decrypted = encrypt(pubKey, plaintext);
    expect(decrypted).not.toEqual(plaintext);
  });

  it('should detect ciphertext changes thru MAC', () => {
    const plaintext = Buffer.from('spam');
    const privKey = crypto.randomBytes(32);
    const pubKey = eutil.privateToPublic(privKey);
    const encrypted = encrypt(pubKey, plaintext);
    const modifiedEncrypted = Buffer.allocUnsafe(encrypted.byteLength);
    encrypted.copy(modifiedEncrypted, 0, 0, 113);
    expect(() => decrypt(privKey, modifiedEncrypted)).toThrow('MAC mismatch');
  });

  it('should be able to encrypt and decrypt a longer message (1024 bytes)', () => {
    const plaintext = crypto.randomBytes(1024);
    const privKey = crypto.randomBytes(32);
    const pubKey = eutil.privateToPublic(privKey);
    const encrypted = encrypt(pubKey, plaintext);
    const decrypted = decrypt(privKey, encrypted);
    expect(decrypted).toEqual(plaintext);
  });
});
