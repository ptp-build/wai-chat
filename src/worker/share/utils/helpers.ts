import PasswordValidator from "password-validator";
import {sha256} from "ethereum-cryptography/sha256";

const SALT = 'wai ai blockchain auto bot';

export function passwordCheck(password:string){
  const schema = new PasswordValidator();
  schema
    .is().min(8)                                    // Minimum length 8
    .is().max(100)                                  // Maximum length 100
    .has().uppercase()                              // Must have uppercase letters
    .has().lowercase()                              // Must have lowercase letters
    .has().not().spaces()                           // Should not have spaces
    .is().not().oneOf(['Passw0rd', 'Password123']); // Blacklist these values

  return schema.validate(password);
}

export function hashSha256(text:string):string{
  return sha256(Buffer.from(`${text}${SALT}`)).toString("hex")
}

