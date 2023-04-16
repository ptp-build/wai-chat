import EcdsaHelper from '../EcdsaHelper';
import { decrypt, encrypt } from '../EthEcies';
import Mnemonic from '../Mnemonic';
import Wallet from '../Wallet';

it('Ecdsa test', async () => {
  const mnemonic = new Mnemonic(
    'lunch pause flip lizard walnut purse airport host alpha tomato mother absent'
  );
  console.debug(mnemonic.getWords());
  let wallet = new Wallet(mnemonic);
  let { prvKey, pubKey, address, pubKey_ } = wallet.getEthWallet(0);

  let r = wallet.getEthWallet(0, true);
  console.debug('pubKey_', r.pubKey_);
  console.debug({ prvKey, pubKey, address, pubKey_ });
  const ecdsa = new EcdsaHelper({
    prvKey,
    pubKey,
  });
  const message = 'abc123';
  const signRes = ecdsa.sign(message);
  console.debug(signRes);
  expect(signRes.length).toBe(65);

  const address1 = EcdsaHelper.recoverAddress({ message, sig: signRes });
  console.debug(address1);
  expect(address1).toBe(address);
  const data = Buffer.from('中12foo', 'utf-8');
  const encrypted = encrypt(pubKey_, data);
  console.debug(encrypted);
  const decrypted = decrypt(prvKey, encrypted);
  console.debug(decrypted);
  expect(decrypted).toEqual(data);
});
