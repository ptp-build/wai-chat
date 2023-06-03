import {getWebPlatform} from "../../global/actions/api/initial";

export type MobileBridgeEventType = "WAI_APP_INIT" | "SET_THEME"
export default class MobileBridge {
  static postEvent(eventName:MobileBridgeEventType,eventData?:any){
    setTimeout(()=>{
      console.log("MobileBridge postEvent",eventName,eventData,getWebPlatform())
      if(getWebPlatform() === "android"){
        // @ts-ignore
        window.WaiBridge.postEvent(eventName,eventData ? JSON.stringify(eventData) : "{}")
      }
      if(getWebPlatform() === "ios"){

      }
    })
  }
}
