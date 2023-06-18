import {
  entropyToMnemonic,
  generateMnemonic,
  mnemonicToEntropy,
  mnemonicToSeedSync,
  setDefaultWordlist,
  validateMnemonic,
} from 'bip39';

export type MnemonicLangEnum = 'english' | 'chinese_simplified';

function containsChinese(str:string) {
  var reg = /[\u4E00-\u9FFF]/;
  return reg.test(str);
}


export default class Mnemonic {
  private lang: MnemonicLangEnum | undefined;
  private words: string | undefined;

  constructor(words?: string, lang?: MnemonicLangEnum) {
    if (!lang) {
      if(words && containsChinese(words)){
        lang = 'chinese_simplified';
      }else{
        lang = 'english';
      }
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
    if(lang){
      setDefaultWordlist(lang);
    }
    const words = entropyToMnemonic(entropy);
    return new Mnemonic(words, lang);
  }
}
