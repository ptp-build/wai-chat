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
  async handleCallbackButton(data: string,outgoingMsgId:number = 0) {
    switch (data){
      case this.chatId + "/local/setUpProxy":
        const initVal = window.localStorage.getItem("proxy") || ""
        const {value} = await showModalFromEvent({
          initVal,
          title: "设置代理",
          placeholder: "如: socks5://1.1.1.1:2000@username:password"
        });
        if(initVal !== value){
          window.localStorage.setItem("proxy",value || "")
        }
        break
      case "local/createChatGptBotWorker":
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
          let workers_accounts = WaiBotWorker.getWorkersAccounts()
          const accounts = Object.values(workers_accounts)

          const account = accounts.find(account=>account.botId === this.chatId)
          const accountNum = accounts.length
          const ts = currentTs1000();
          let accountId =  account ? account.accountId : currentTs1000();
          const resSign = await Account.getCurrentAccount()?.signMessage(`${ts}`,hashSha256(password!))

          const proxy = window.localStorage.getItem("proxy") || ""

          const accountSign = `${resSign!.sign.toString("hex")}_${ts}_${accountId}`
          const eventData = JSON.stringify({
            ...account,
            accountNum,
            proxy,
            accountSign,
            accountId,
          })
          await new WaiBotWorker(this.chatId,this.messageId).handleCallbackButton("ipcMain/createChatGptBotWorker/"+Buffer.from(eventData).toString("hex"));
        }
        break
    }
  }
}
