import ChatMsg from "../ChatMsg";
import Account from "../../share/Account";
import MsgDispatcher from "../MsgDispatcher";
import {hashSha256} from "../../share/utils/helpers";
import {getPasswordFromEvent} from "../../share/utils/password";
import {currentTs1000} from "../../share/utils/utils";
import {WaiBotWorker} from "./WaiBotWorker";
import {UserIdFirstBot} from "../../setting";
import {showModalFromEvent} from "../../share/utils/modal";

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
    let workers_accounts = WaiBotWorker.getWorkersAccounts()
    const accounts = Object.values(workers_accounts)
    const account = accounts.find(account=>account.botId === this.chatId)
    const initVal = account ? account.proxy : window.localStorage.getItem("chatGptAuthUser") || ""

    const {value} = await showModalFromEvent({
      initVal,
      title: "设置ChatGpt用户名和密码",
      placeholder: "如: username:password"
    });
    if(initVal !== value){
      if(account){
        WaiBotWorker.updateWorkersAccount(account.accountId,{
          ...account,
          chatGptAuthUser:value||""
        })
      }else{
        window.localStorage.setItem("chatGptAuthUser",value || "")
      }
    }
  }

  async setUpProxy(){
    let workers_accounts = WaiBotWorker.getWorkersAccounts()
    const accounts = Object.values(workers_accounts)
    const account = accounts.find(account=>account.botId === this.chatId)
    const initVal = account ? account.proxy : window.localStorage.getItem("proxy") || ""
    const {value} = await showModalFromEvent({
      initVal,
      title: "设置代理",
      placeholder: "如: socks5://1.1.1.1:2000@username:password"
    });
    if(initVal !== value){
      if(account){
        WaiBotWorker.updateWorkersAccount(account.accountId,{
          ...account,
          proxy:value||""
        })
      }else{
        window.localStorage.setItem("proxy",value || "")
      }
    }
  }
  async createChatGptBotWorker(){
    let workers_accounts = WaiBotWorker.getWorkersAccounts()
    const accounts = Object.values(workers_accounts)
    const account = accounts.find(account=>account.botId === this.chatId)
    const accountNum = accounts.length

    let accountSign;
    let accountId;
    let proxy;
    let chatGptAuthUser;
    if(account){
      accountSign = account.accountSign
      accountId = account.accountId
      chatGptAuthUser = account.chatGptAuthUser || ""
      proxy = account.proxy || ""
    }else{
      chatGptAuthUser = window.localStorage.getItem("chatGptAuthUser") || ""
      proxy = window.localStorage.getItem("proxy") || ""
    }

    if(this.chatId === UserIdFirstBot){
      const {password} = await getPasswordFromEvent(
        undefined,true,
        "mnemonicPasswordVerify",
        false,
        {
          title:"账户助记词密码"
        }
      )
      if(!password){
        return
      }
      const verifyRes = await Account.getCurrentAccount()?.verifySession(Account.getCurrentAccount()?.getSession()!,password!)
      if(!verifyRes){
        MsgDispatcher.showNotification("密码不正确")
        return
      }else{

        const ts = currentTs1000();
        accountId =  currentTs1000();
        const resSign = await Account.getCurrentAccount()?.signMessage(`${ts}`,hashSha256(password!))
        accountSign = `${resSign!.sign.toString("hex")}_${ts}_${accountId}`
      }
    }

    const eventData = JSON.stringify({
      ...account,
      proxy,
      chatGptAuthUser,
      accountNum,
      accountSign,
      accountId,
    })
    await new WaiBotWorker(this.chatId,this.messageId).handleCallbackButton("ipcMain/createChatGptBotWorker/"+Buffer.from(eventData).toString("hex"));


  }
  async handleCallbackButton(data: string,outgoingMsgId:number = 0) {
    switch (data){
      case "local/setUpChatGptAuthUser":
        await this.setUpChatGptAuthUser();
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
