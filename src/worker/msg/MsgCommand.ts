import MsgDispatcher from "./MsgDispatcher";
import {selectUser} from "../../global/selectors";
import {updateUser} from "../../global/reducers";
import {getActions, getGlobal, setGlobal} from "../../global";
import {ApiBotCommand, ApiMessage} from "../../api/types";
import {currentTs} from "../share/utils/utils";
import {GlobalState} from "../../global/types";
import MsgCommandSetting from "./MsgCommandSetting";
import {ControllerPool} from "../../lib/ptp/functions/requests";
import MsgCommandChatGpt from "./MsgCommandChatGpt";
import MsgCommandChatLab from "./MsgCommandChatLab";
import {UserStoreRow_Type} from "../../lib/ptp/protobuf/PTPCommon/types";
import {callApiWithPdu} from "./utils";
import {DownloadUserReq, DownloadUserRes, UploadUserReq} from "../../lib/ptp/protobuf/PTPUser";
import BotWebSocket, {BotWebSocketNotifyAction, BotWebSocketState} from "./bot/BotWebSocket";
import Account from "../share/Account";
import {Pdu} from "../../lib/ptp/protobuf/BaseMsg";
import {ActionCommands} from "../../lib/ptp/protobuf/ActionCommands";
import {SendRes} from "../../lib/ptp/protobuf/PTPMsg";

export default class MsgCommand {
  private msgDispatcher: MsgDispatcher;
  constructor(msgDispatcher:MsgDispatcher) {
    this.msgDispatcher = msgDispatcher;
  }
  static async sendText(chatId:string,text:string){
    const messageId = await MsgDispatcher.genMsgId();
    MsgDispatcher.newMessage(chatId,messageId,{
      chatId,
      id:messageId,
      senderId:chatId,
      isOutgoing:false,
      date:currentTs(),
      content:{
        text:{
          text:text
        }
      },
    })
  }
  static buildInlineCallbackButton(chatId:string,path:string,text:string,type:'callback' = 'callback'){
    return [
      {
        type,
        text,
        data:`${chatId}/${path}`
      }
    ]
  }

  static buildInlineButton(chatId:string,text:string,type:'requestUploadImage'|'unsupported'){
    return [
      {
        type,
        text,
      }
    ]
  }
  static async clearHistory(chatId:string){
    await MsgDispatcher.newTextMessage(chatId,undefined,'确定要清除么？',[
      [
        ...MsgCommand.buildInlineCallbackButton(chatId,"clearHistory/confirm","确定","callback"),
        ...MsgCommand.buildInlineCallbackButton(chatId,"clearHistory/cancel","返回","callback")
      ]
    ])

    return true;
  }

  async showMnemonic(){
    await this.msgDispatcher.sendOutgoingMsg();
    await this.msgDispatcher.replyText("显示成功")
    getActions().updateGlobal({
      showMnemonicModal:true
    })
  }

  static async reloadCommands(chatId:string,cmds:ApiBotCommand[]){
    let global = getGlobal();
    let user = selectUser(global,chatId)
    const botInfo = user?.fullInfo?.botInfo;
    if(botInfo){
      //@ts-ignore
      const commands:ApiBotCommand[] = cmds.map(cmd => {
        return {
          ...cmd,
          botId: user?.id
        };
      });
      global = updateUser(global,user?.id!,{
        ...user,
        fullInfo:{
          ...user?.fullInfo,
          botInfo:{
            ...user?.fullInfo!.botInfo!,
            commands
          }
        }
      })
      setGlobal(global)
      global = getGlobal()
      user = selectUser(global,chatId)
      await MsgDispatcher.newTextMessage(chatId,await MsgDispatcher.genMsgId(),"重载成功")
      return true;
    }
  }
  static async uploadUser(global:GlobalState,chatId:string){
    const users:UserStoreRow_Type[] = [];
    const ids = [chatId]
    for (let i = 0; i < ids.length; i++) {
      if(i > 0){
        break
      }
      const id = ids[i];
      users.push({
        time:currentTs(),
        userId:id!,
        user:selectUser(global,chatId)
      })
    }
    await callApiWithPdu(new UploadUserReq({
      users,
      time:currentTs()
    }).pack())
    MsgDispatcher.showNotification("上传成功")
  }
  static async downloadUser(global:GlobalState,chatId:string){
    const DownloadUserReqRes = await callApiWithPdu(new DownloadUserReq({
      userIds:[chatId],
    }).pack())
    const downloadUserRes = DownloadUserRes.parseMsg(DownloadUserReqRes?.pdu!)
    if(downloadUserRes.users){
      const {user} = downloadUserRes.users[0]
      global = getGlobal();
      // @ts-ignore
      global = updateUser(global,user!.id, user)
      setGlobal(global)
    }
    MsgDispatcher.showNotification("更新成功")
  }
  async setting(){
    const chatId = this.msgDispatcher.getChatId()
    await this.msgDispatcher.sendOutgoingMsg();
    return await MsgCommandSetting.setting(chatId);
  }
  static async requestUploadImage(global:GlobalState,chatId:string,messageId:number,files:FileList | null){
    await MsgCommandSetting.requestUploadImage(global,chatId,messageId,files)
  }
  static async answerCallbackButton(global:GlobalState,chatId:string,messageId:number,data:string){
    await MsgCommandSetting.answerCallbackButton(global,chatId,messageId,data)
    await MsgCommandChatGpt.answerCallbackButton(global,chatId,messageId,data)
    await MsgCommandChatLab.answerCallbackButton(global,chatId,messageId,data)

    if(data.endsWith("clearHistory/confirm")){
      let global = getGlobal();
      const chatMessages = global.messages.byChatId[chatId];
      const ids = Object.keys(chatMessages.byId).map(Number);
      getActions().sendBotCommand({chatId,command:"/start"})
      MsgDispatcher.apiUpdate({
        "@type":"deleteMessages",
        chatId,
        ids
      })
    }

    if(data.endsWith("clearHistory/cancel")){
      return MsgDispatcher.updateMessage(chatId,messageId, {
          inlineButtons: []
        }
      )
    }

    if(data.startsWith("requestChatStream/stop/")){
      const [chatId,messageId] = data.replace("requestChatStream/stop/","").split("/").map(Number)
      ControllerPool.stop(chatId,messageId);
    }
    if(data.startsWith("requestChatStream/stop/")){
      const [chatId,messageId] = data.replace("requestChatStream/stop/","").split("/").map(Number)
      ControllerPool.stop(chatId,messageId);
    }
  }
  static async createWsBot(chatId:string){
    const global = getGlobal();
    const user = selectUser(global,chatId)
    const botWs = BotWebSocket.getInstance(chatId)
    if(!botWs.isConnect() && user?.fullInfo?.botInfo?.aiBot && user?.fullInfo?.botInfo?.aiBot!.botApi){
      botWs.setMsgHandler(async (chatId, notifies)=>{
        for (let i = 0; i < notifies.length; i++) {
          const {action,payload} = notifies[i]
          switch (action){
            case BotWebSocketNotifyAction.onConnectionStateChanged:
              switch (payload.BotWebSocketState){
                case BotWebSocketState.connected:
                  await MsgDispatcher.newTextMessage(chatId,undefined,"已连接")
                  break;
                case BotWebSocketState.closed:
                  // await MsgDispatcher.newTextMessage(chatId,undefined,"已断开")
                  break;
              }
              break
            case BotWebSocketNotifyAction.onData:
              await MsgCommand.handleWsBotOnData(chatId,payload)
              break
          }
        }
      })
      botWs.setWsUrl(user?.fullInfo?.botInfo?.aiBot.botApi)
      botWs.setSession(Account.getCurrentAccount()?.getSession()!)
      botWs.connect();
      await botWs.waitForMsgServerState(BotWebSocketState.connected)
    }
  }
  static async handleNewMessage(pdu:Pdu){
    const {msg,text,chatId} = SendRes.parseMsg(pdu)
    if(text){
      return MsgDispatcher.newTextMessage(
        chatId,undefined,
        text
      )
    }else{
      // @ts-ignore
      const message:ApiMessage = msg
      return MsgDispatcher.newMessage(
        chatId,message.id,
        message
      )
    }
  }
  static async handleUpdateMessage(pdu:Pdu){
    const {msg,chatId} = SendRes.parseMsg(pdu)
    // @ts-ignore
    const message:Partial<ApiMessage> = msg
    return MsgDispatcher.updateMessage(
      chatId,message.id!,
      message
    )
  }
  static async handleWsBotOnData(chatId:string,pdu:Pdu){
    switch (pdu.getCommandId()){
      case ActionCommands.CID_SendRes:
        const {action} = SendRes.parseMsg(pdu)
        switch (action){
          case "newMessage":
            return await MsgCommand.handleNewMessage(pdu)
          case "updateMessage":
            return await MsgCommand.handleUpdateMessage(pdu)
        }
        break
    }
  }
}
