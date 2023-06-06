
export const getInitTheme = () =>{
  //@ts-ignore
  return window.__THEME;
}

export const getWebPlatform = ():"web"|"ios"|"android"|"desktop"=>{
  //@ts-ignore
  return window.__PLATFORM || "web"
}

export const isWebPlatform = async ()=>{
  return getWebPlatform() === 'web'
}


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
