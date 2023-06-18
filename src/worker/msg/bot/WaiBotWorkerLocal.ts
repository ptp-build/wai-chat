import ChatMsg from "../ChatMsg";
import Account from "../../share/Account";
import MsgDispatcher from "../MsgDispatcher";
import {hashSha256} from "../../share/utils/helpers";
import {getPasswordFromEvent} from "../../share/utils/password";
import {currentTs1000} from "../../share/utils/utils";
import {WaiBotWorker} from "./WaiBotWorker";
import {UserIdFirstBot} from "../../setting";
import {showModalFromEvent} from "../../share/utils/modal";
import {encodeCallBackButtonPayload} from "../MsgCommand";
import {getUserId} from "../../../global/actions/api/chats";

export class WaiBotWorkerLocal{
  private chatId: string;
  private messageId: number;
  private chatMsg: ChatMsg;
  constructor(chatId:string,messageId:number) {
    this.chatId = chatId;
    this.messageId = messageId;
    this.chatMsg = new ChatMsg(this.chatId);

  }
  async setUpChatGptAuthUser(){
    const account = WaiBotWorker.getWorkersAccount(this.chatId)
    const initVal = account ? account.chatGptAuthUser : window.localStorage.getItem("chatGptAuthUser") || ""

    const {value} = await showModalFromEvent({
      initVal,
      title: "设置ChatGpt用户名和密码",
      placeholder: "如: username:password"
    });
    if(initVal !== value){
      if(account){
        WaiBotWorker.updateWorkersAccount(account.botId,{
          ...account,
          chatGptAuthUser:value||""
        })
      }else{
        window.localStorage.setItem("chatGptAuthUser",value || "")
      }
    }
  }

  async setUpProxy(){
    const account = WaiBotWorker.getWorkersAccount(this.chatId)
    const initVal = account ? account.proxy : window.localStorage.getItem("proxy") || ""
    const {value} = await showModalFromEvent({
      initVal,
      title: "设置代理",
      placeholder: "如: socks5://ip:port@user:pwd"
    });
    if(initVal !== value){
      if(account){
        WaiBotWorker.updateWorkersAccount(account.botId,{
          ...account,
          proxy:value||""
        })
      }else{
        window.localStorage.setItem("proxy",value || "")
      }
    }
  }
  async clearAllWindow(){
    WaiBotWorker.clearWorkersAccounts()
    WaiBotWorker.call_handleCallbackButton("ipcMain/closeAllWindow")
  }
  async createChatGptBotWorker(){
    let workers_accounts = WaiBotWorker.getWorkersAccounts()
    const accounts = Object.values(workers_accounts)
    const account = WaiBotWorker.getWorkersAccount(this.chatId)
    const accountNum = accounts.length

    let proxy;
    let chatGptAuthUser;
    let botId;
    let isCreate = false;
    let isMasterBot = this.chatId === UserIdFirstBot
    if(account){
      botId = account.botId
      chatGptAuthUser = account.chatGptAuthUser || ""
      proxy = account.proxy || ""
    }else{
      isCreate = true;
      botId = this.chatId === UserIdFirstBot ? await getUserId() : this.chatId
      chatGptAuthUser = window.localStorage.getItem("chatGptAuthUser") || ""
      proxy = window.localStorage.getItem("proxy") || ""
    }

    const eventData = {
      ...account,
      botId,
      isMasterBot,
      isCreate,
      accountNum,
      chatGptAuthUser,
      proxy
    }
    await new WaiBotWorker(this.chatId,this.messageId).handleCallbackButton(encodeCallBackButtonPayload("ipcMain/createChatGptBotWorker",eventData));
  }
  async handleCallbackButton(data: string,outgoingMsgId:number = 0) {
    switch (data){
      case "local/setUpChatGptAuthUser":
        await this.setUpChatGptAuthUser();
        break
      case "local/clearAllWindow":
        await this.clearAllWindow();
        break
      case "local/setUpProxy":
        await this.setUpProxy();
        break
      case "local/createChatGptBotWorker":
        await this.createChatGptBotWorker();
        break
    }
  }
}
