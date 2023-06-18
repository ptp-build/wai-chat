import {PasswordHelperType} from "../../../components/ui/PasswordModal";

export type PasswordFromEventOptions = {
  title?:string,
  mnemonic?:string,
  backGroundBlack?:boolean
}

export type PasswordFromEventResult = {
  password?:string,
  hint?:string,
  mnemonic?:string,
}

export const getPasswordFromEvent = async (
  hint?:string,
  hideHitInput?:boolean,
  passwordHelper?:PasswordHelperType,
  noBackdropClose?:boolean,
  options?:PasswordFromEventOptions
)=>{
  return new Promise<PasswordFromEventResult>((resolve)=>{
    const event = new CustomEvent('password',{
      detail:{
        hint,
        noBackdropClose,
        hideHitInput,
        passwordHelper,
        options,
        callback:(res:PasswordFromEventResult)=>{
          resolve(res)
        }
      }
    });
    document.dispatchEvent(event);
  })
}
