import {PasswordHelperType} from "../../../components/ui/PasswordModal";

export const getPasswordFromEvent = async (hint?:string,hideHitInput?:boolean,passwordHelper?:PasswordHelperType,noBackdropClose?:boolean)=>{
  return new Promise<{password:string,hint?:string}>((resolve)=>{
    const event = new CustomEvent('password',{
      detail:{
        hint,
        noBackdropClose,
        hideHitInput,
        passwordHelper,
        callback:({password,hint}:{password:string,hint?:string})=>{
          resolve({password,hint})
        }
      }
    });
    document.dispatchEvent(event);
  })
}
