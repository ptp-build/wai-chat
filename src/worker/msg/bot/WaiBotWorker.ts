import {sleep} from "../utils";
import ChatMsg from "../ChatMsg";
import MsgCommand, {encodeCallBackButtonPayload} from "../MsgCommand";
import {getUserId} from "../../../global/actions/api/chats";
import {getActions} from "../../../global";
import {MSG_SERVER} from "../../../config";
import Account from "../../share/Account";

export type BotWorkerAccountType = {
  botId:string,
  type:"chatGpt",
  proxy:string,
  chatGptAuthUser:string,
  accountSign:string,
  appWidth:number,
  appHeight:number,
  appPosX:number,
  appPosY:number
}
export class WaiBotWorker{
  private chatId: string;
  private messageId: number;
  private chatMsg: ChatMsg;
  constructor(chatId:string,messageId:number) {
    this.chatId = chatId;
    this.messageId = messageId;
    this.chatMsg = new ChatMsg(this.chatId);

  }
  static getWorker(){
    //@ts-ignore
    return window.__WaiBotWorker;
  }
  static onLogin(){
    const accountId = Account.getCurrentAccountId();
    const accountSign = Account.getCurrentAccount()?.getSession();
    const msgServer = MSG_SERVER!
    const data = encodeCallBackButtonPayload("ipcMain/startWsClient",{
      accountId,accountSign,msgServer
    })
    console.log("worker onLogin",accountId,data)
    WaiBotWorker.call_handleCallbackButton(data)
  }
  static async call_handleCallbackButton(data:string){
    return await WaiBotWorker.getWorker().handleCallbackButton(data);
  }
  async handleCallbackButton(data: string,outgoingMsgId:number = 0) {
    const {chatId} = this
    await sleep(100);
    let inlineButtonsList = [
      MsgCommand.buildInlineCallbackButton(chatId, `${outgoingMsgId}/setting/cancel`, "取消")
    ];

    try {
      let {
        text,
        payload,
        inlineButtons
      }  = await WaiBotWorker.call_handleCallbackButton(data);
      if(payload && data.includes("ipcMain/createChatGptBotWorker")){
        const createChatGptBotWorkerRes = await this.handleCreateChatGptBotWorkerRes(payload)
        text = createChatGptBotWorkerRes.text
        inlineButtonsList = [
          ...createChatGptBotWorkerRes.inlineButtons,
        ];
      }
      if (inlineButtons) {
        inlineButtonsList = [
          ...inlineButtons,
          ...inlineButtonsList,
        ];
      }

      if (text) {
        const msg = await this.chatMsg.setText(text)
          .reply();
        console.log(inlineButtons)
        return await this.chatMsg.update(msg.id, {
          content: {
            text: {
              text: text!
            }
          },
          inlineButtons: inlineButtonsList
        });
      }
    } catch (e) {
      console.error(e);
      // await this.chatMsg.update(msg.id, {
      //   content: {
      //     text: {
      //       text: "请求错误"
      //     }
      //   },
      //   inlineButtons: inlineButtonsList
      // });
    }
  }

  async handleCreateChatGptBotWorkerRes(payload:any){
    const accounts = WaiBotWorker.getWorkersAccounts()
    if(payload.isCreate){
      delete payload.isCreate
      WaiBotWorker.updateWorkersAccount(payload.botId,{
        ...payload,
      })
      getActions().createChat({
        id:payload.botId,
        title:`# ${Object.keys(accounts).length + 1} ChatGptBotWorker`,
        enableAi:true
      })
      return {
        text:`#ID: ${payload.botId}\n类型: ChatGpt`,
        inlineButtons:[
          [
            ...MsgCommand.buildInlineCallbackButton(this.chatId,`actions/openChatId/${payload.botId}`,"管理Worker")
          ]
        ]
      }
    }else{
      return {
        text:"",
        inlineButtons:[]
      }
    }
  }

  static clearWorkersAccounts(){
    window.localStorage.removeItem("workers_account");
  }
  static getWorkersAccounts():Record<number, BotWorkerAccountType>{
    const workers_account_str = window.localStorage.getItem("workers_account");
    let workers_accounts:Record<string, BotWorkerAccountType> = {}
    if(workers_account_str){
      workers_accounts = JSON.parse(workers_account_str)
    }
    return workers_accounts
  }

  static getWorkersAccount(botId:string):BotWorkerAccountType{
    const workers_accounts:any = WaiBotWorker.getWorkersAccounts()
    return workers_accounts[botId] || null
  }

  static updateWorkersAccount(botId:string,account:BotWorkerAccountType){
    const workers_accounts:any = WaiBotWorker.getWorkersAccounts()
    workers_accounts[botId] = account
    console.log("[updateWorkersAccount]",botId,workers_accounts)
    window.localStorage.setItem("workers_account",JSON.stringify(workers_accounts));
  }
}
