import { generateMnemonic, setDefaultWordlist } from 'bip39';

import Mnemonic, {MnemonicLangEnum} from '../Mnemonic';

it('bip39 test', async () => {
  let lang: MnemonicLangEnum = 'english';
  setDefaultWordlist(lang);
  let wordlist = generateMnemonic();
  console.debug(wordlist);
  expect(wordlist.split(' ').length).toBe(12);

  lang = 'chinese_simplified';
  setDefaultWordlist(lang);
  wordlist = generateMnemonic();
  console.debug(wordlist);
  expect(wordlist.split(' ').length).toBe(12);
});

it('MnemonicHelper test', async () => {
  let mnemonic = new Mnemonic();
  console.debug(mnemonic.getWords());
  expect(mnemonic.getWords()!.split(' ').length).toBe(12);
  expect(mnemonic.getLang()).toBe('english');

  mnemonic = new Mnemonic(undefined, 'chinese_simplified');
  console.debug(mnemonic.getWords());
  const words = mnemonic.getWords();
  expect(mnemonic.getWords()!.split(' ').length).toBe(12);
  expect(mnemonic.getLang()).toBe('chinese_simplified');

  const seed = mnemonic.toSeedBuffer();
  const seedHex = mnemonic.toSeedHex(undefined);
  const seedWithPassword = mnemonic.toSeedBuffer('12345');

  const entropy = mnemonic.toEntropy();
  console.debug('seed', seed);
  console.debug('seedWithPassword', seedWithPassword);
  console.debug('seedHex', seedHex);
  console.debug('seed buffer', Buffer.from(seedHex));
  console.debug('entropy', entropy);

  mnemonic = Mnemonic.fromEntropy(entropy);
  expect(mnemonic.getWords()!.split(' ').length).toBe(12);
  expect(mnemonic.getWords()!).toBe(words);
});

it('MnemonicHelper test1', async () => {
  let mnemonic = new Mnemonic();
  mnemonic = new Mnemonic(
    'host supreme priority trophy clock wood enjoy pipe unknown convince achieve reflect',
    'english'
  );

  console.debug(mnemonic.getWords());
  expect(mnemonic.getWords()!.split(' ').length).toBe(12);
  expect(mnemonic.getLang()).toBe('english');

  const seed = mnemonic.toSeedBuffer();
  const seedHex = mnemonic.toSeedHex(undefined);
  const seedWithPassword = mnemonic.toSeedBuffer('12345');

  const entropy = mnemonic.toEntropy();
  console.debug('seed', seed);
  console.debug('seedWithPassword', seedWithPassword);
  console.debug('seedHex', seedHex);
  console.debug('seed buffer', Buffer.from(seedHex));
  console.debug('entropy', entropy);

  mnemonic = Mnemonic.fromEntropy(entropy);
  expect(mnemonic.getWords()!.split(' ').length).toBe(12);
});
