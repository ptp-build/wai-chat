export type ShowModalFromEventPayload = {
  title?:string,
  type?:'singleInput'|'multipleInput',
  placeholder?:string,
  initVal?:string
  max?:number
  min?:number
  step?:number
  showQrcode?:boolean
  inputType?:string
  buttonTxt?:string
}
export type ShowModalFromEventResult = {
  value?:string,
}

export async function showModalFromEvent(payload:ShowModalFromEventPayload):Promise<ShowModalFromEventResult>{
  return new Promise((resolve)=>{
    const event = new CustomEvent('modal',{
      detail:{
        payload,
        callback:(res:ShowModalFromEventResult)=>{
          resolve(res)
        }
      }
    });
    document.dispatchEvent(event);
  })
}
