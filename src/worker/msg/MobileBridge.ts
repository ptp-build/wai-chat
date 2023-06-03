import {getWebPlatform} from "../../global/actions/api/initial";

export type MobileBridgeAction = "APP_INIT"
export default class MobileBridge {
  static postEvent(eventName:MobileBridgeAction,eventData?:any){
    console.log("MobileBridge postEvent",eventName,eventData,getWebPlatform())
    if(getWebPlatform() === "android"){
      // @ts-ignore
      window.WaiBridge.postEvent(eventName,eventData ? JSON.stringify(eventData) : "{}")
    }
    if(getWebPlatform() === "ios"){

    }
  }
}
