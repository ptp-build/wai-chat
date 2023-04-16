import Mnemonic from '../Mnemonic';
import Wallet from '../Wallet';

it('Wallet test', async () => {
  const mnemonic = new Mnemonic(
    'host supreme priority trophy clock wood enjoy pipe unknown convince achieve reflect'
  );
  console.debug(mnemonic.getWords());
  let wallet = new Wallet(mnemonic);
  console.debug(mnemonic.toEntropy());
  console.debug(wallet);
  const masterKey = wallet.getMashKey();
  console.debug(masterKey);
  const ethWallet = wallet.getEthWallet(0);
  console.debug(ethWallet);
  expect(ethWallet.path).toBe("m/44'/60'/0'/0/0");
  let ethWallet1 = wallet.getEthWallet(0, true);
  console.debug(ethWallet1);
  expect(ethWallet.path).toBe("m/44'/60'/0'/0/0");
  wallet = new Wallet(mnemonic, '1234234');
  ethWallet1 = wallet.getEthWallet(0, true);
  console.debug(ethWallet1);
  wallet = new Wallet(mnemonic, 'wwwww');
  ethWallet1 = wallet.getEthWallet(1, true);
  console.debug(ethWallet1);
  expect(ethWallet1.path).toBe("m/44'/60'/0'/0/1");
});

it('Wallet test1', async () => {
  const mnemonic = new Mnemonic(
    'opinion rally million case address approve upper scrub exhibit shock ostrich calm'
  );
  console.debug('words', mnemonic.getWords());
  let wallet = new Wallet(mnemonic);
  console.debug('entropy', mnemonic.toEntropy());
  const ethWallet = wallet.getEthWallet(0);
  expect(ethWallet.path).toBe("m/44'/60'/0'/0/0");
  let ethWallet1 = wallet.getEthWallet(0, true);
  console.debug(ethWallet1);
});
