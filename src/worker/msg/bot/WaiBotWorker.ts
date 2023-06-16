import {sleep} from "../utils";
import ChatMsg from "../ChatMsg";
import MsgCommand from "../MsgCommand";
import {getUserId} from "../../../global/actions/api/chats";
import {getActions} from "../../../global";

export type BotWorkerAccountType = {
  accountId:number,
  botId:string,
  type:"chatGpt",
  proxy:string,
  authUser:string,
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
  async handleCallbackButton(data: string,outgoingMsgId:number = 0) {
    const {chatId} = this
    const msg = await this.chatMsg.setText("...")
      .reply();
    await sleep(100);
    let inlineButtonsList = [
      MsgCommand.buildInlineCallbackButton(chatId, `${outgoingMsgId}/setting/cancel`, "取消")
    ];

    try {
      let {
        text,
        payload,
        inlineButtons
      }  = await WaiBotWorker.getWorker().handleCallbackButton(data);
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
      await this.chatMsg.update(msg.id, {
        content: {
          text: {
            text: "请求错误"
          }
        },
        inlineButtons: inlineButtonsList
      });
    }
  }

  async handleCreateChatGptBotWorkerRes(payload:BotWorkerAccountType){
    const botId = await getUserId()
    const accounts = WaiBotWorker.getWorkersAccounts()
    if(!payload.botId){
      getActions().createChat({
        id:botId,
        title:`# ${Object.keys(accounts).length + 1} ChatGptBotWorker`,
        enableAi:true
      })
      WaiBotWorker.updateWorkersAccount(payload.accountId,{
        ...payload,
        botId
      })
      return {
        text:`#ID: ${payload.accountId}\n类型: ChatGpt`,
        inlineButtons:[
          [
            ...MsgCommand.buildInlineCallbackButton(this.chatId,`actions/openChatId/${botId}`,"管理Worker")
          ]
        ]
      }
    }else{
      return {
        text:`#ID: ${payload.accountId}\n类型: ChatGpt`,
        inlineButtons:[]
      }
    }
  }
  static getWorkersAccounts():Record<number, BotWorkerAccountType>{
    const workers_account_str = window.localStorage.getItem("workers_account");
    let workers_accounts:Record<number, BotWorkerAccountType> = {}
    if(workers_account_str){
      workers_accounts = JSON.parse(workers_account_str)
    }
    return workers_accounts
  }

  static getWorkersAccount(accountId:number):BotWorkerAccountType{
    const workers_accounts:any = WaiBotWorker.getWorkersAccounts()
    return workers_accounts[accountId] || null
  }

  static updateWorkersAccount(accountId:number,account:BotWorkerAccountType){
    const workers_accounts:any = WaiBotWorker.getWorkersAccounts()
    workers_accounts[accountId] = account
    console.log("[updateWorkersAccount]",accountId,workers_accounts)
    window.localStorage.setItem("workers_account",JSON.stringify(workers_accounts));
  }
}
