import {
  entropyToMnemonic,
  generateMnemonic,
  mnemonicToEntropy,
  mnemonicToSeedSync,
  setDefaultWordlist,
  validateMnemonic,
} from 'bip39';

export type MnemonicLangEnum = 'english' | 'chinese_simplified';

export default class Mnemonic {
  private lang: MnemonicLangEnum | undefined;
  private words: string | undefined;

  constructor(words?: string, lang?: MnemonicLangEnum) {
    if (!lang) {
      lang = 'english';
    }
    Object.defineProperty(this, 'lang', {
      value: lang,
      writable: false,
    });

    setDefaultWordlist(this.lang!);
    if (!words) {
      words = generateMnemonic();
    }

    Object.defineProperty(this, 'words', {
      value: words,
      writable: false,
    });
  }

  getLang() {
    return this.lang;
  }

  getWords() {
    return this.words!;
  }

  checkMnemonic() {
    return validateMnemonic(this.words!);
  }

  toSeedBuffer(password?: string) {
    if (!password) password = '';
    return mnemonicToSeedSync(this.getWords()!, password);
  }

  toSeedHex(password?: string) {
    return this.toSeedBuffer(password).toString('hex');
  }
  toEntropy() {
    return mnemonicToEntropy(this.getWords()!);
  }

  static fromEntropy(entropy: string, lang?: MnemonicLangEnum) {
    const words = entropyToMnemonic(entropy);
    return new Mnemonic(words, lang);
  }
}
