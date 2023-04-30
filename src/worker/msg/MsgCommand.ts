import MsgDispatcher from "./MsgDispatcher";
import {selectChatMessage, selectUser} from "../../global/selectors";
import {updateUser} from "../../global/reducers";
import {getActions, getGlobal, setGlobal} from "../../global";
import {ApiBotCommand, ApiKeyboardButton, ApiMessage, ApiUser} from "../../api/types";
import {currentTs, currentTs1000, showBodyLoading} from "../share/utils/utils";
import {GlobalState} from "../../global/types";
import MsgCommandSetting from "./MsgCommandSetting";
import {ControllerPool} from "../../lib/ptp/functions/requests";
import MsgCommandChatGpt from "./MsgCommandChatGpt";
import {ERR, UserStoreRow_Type} from "../../lib/ptp/protobuf/PTPCommon/types";
import {callApiWithPdu} from "./utils";
import {
  DownloadUserReq,
  DownloadUserRes,
  ShareBotReq,
  ShareBotRes, ShareBotStopReq, ShareBotStopRes,
  UploadUserReq
} from "../../lib/ptp/protobuf/PTPUser";
import Account from "../share/Account";
import {DownloadMsgReq, DownloadMsgRes} from "../../lib/ptp/protobuf/PTPMsg";
import {getPasswordFromEvent} from "../share/utils/password";
import {hashSha256} from "../share/utils/helpers";
import ChatMsg from "./ChatMsg";
import {createBot} from "../../global/actions/api/chats";

export default class MsgCommand {
  private chatId: string;
  private chatMsg:ChatMsg
  constructor(chatId:string) {
    this.chatId = chatId;
    this.chatMsg = new ChatMsg(this.chatId)
  }

  back(global:GlobalState,messageId:number,data:string,path:string){
    if(path.startsWith("/")){
      path = path.substring(1)
    }
    const btn = data.replace(`${this.chatId}/${path}/`,"")
    const inlineButtons:ApiKeyboardButton[][] = JSON.parse(btn);
    this.chatMsg.update(messageId,{
      inlineButtons
    })
  }
  static buildInlineBackButton(chatId:string,messageId:number,path:string,text:string){
    if(path.startsWith("/")){
      path = path.substring(1)
    }
    return MsgCommand.buildInlineCallbackButton(chatId,path+"/"+JSON.stringify(selectChatMessage(getGlobal(),chatId,messageId)!.inlineButtons),text,"callback")
  }

  static buildInlineOpenProfileBtn(chatId:string,text:string){
    return [
      {
        type:"userProfile",
        text,
        userId:chatId
      }
    ]
  }

  static buildInlineCallbackButton(chatId:string,path:string,text:string,type:'callback' = 'callback'){
    if(path.startsWith("/")){
      path = path.substring(1)
    }
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
  async clearHistory(){
    await this.chatMsg.setText("确定要清除么?").setInlineButtons([
      [
        ...MsgCommand.buildInlineCallbackButton(this.chatId,"clearHistory/confirm","确定","callback"),
        ...MsgCommand.buildInlineCallbackButton(this.chatId,"clearHistory/cancel","返回","callback")
      ]
    ]).reply()
    return true;
  }

  async reloadCommands(cmds:ApiBotCommand[]){
    let global = getGlobal();
    let user = selectUser(global,this.chatId)
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
      user = selectUser(global,this.chatId)
      return true;
    }
  }
  async uploadUser(global:GlobalState,messageId:number){
    const chatId = this.chatId;
    await this.chatMsg.updateText(messageId,'正在上传...')

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
    const res = await callApiWithPdu(new UploadUserReq({
      users,
      time:currentTs()
    }).pack())
    if(res){
      await this.chatMsg.updateText(messageId,"上传成功")
    }else{
      await this.chatMsg.updateText(messageId,"上传失败")
    }
  }

  async downloadMsg(global:GlobalState,messageId:number) {
    await this.chatMsg.updateText(messageId, "正在更新...")
    const DownloadMsgReqRes = await callApiWithPdu(new DownloadMsgReq({
      chatId:this.chatId
    }).pack())
    const downloadMsgRes = DownloadMsgRes.parseMsg(DownloadMsgReqRes?.pdu!)
    console.log("downloadMsgRes",downloadMsgRes,global.messages.byChatId[this.chatId])
    if(downloadMsgRes.messages){
      for (let i = 0; i < downloadMsgRes.messages.length; i++) {
        const {message} = downloadMsgRes.messages[i];
        if(message){
          if(message.previousLocalId){
            delete message.previousLocalId
          }
          if(selectChatMessage(global,this.chatId,message!.id)){
            await this.chatMsg.update(message!.id,message as ApiMessage)
          }else{
            await this.chatMsg.sendNewMessage(message as ApiMessage)
          }
        }
      }
    }
    await this.chatMsg.updateText(messageId,`更新成功,共: ${downloadMsgRes.messages ? downloadMsgRes.messages.length : 0} 条`)
  }
  static async downloadUsers(global:GlobalState,userIds:string[]){
    console.log("[downloadUsers]",userIds)
    const DownloadUserReqRes = await callApiWithPdu(new DownloadUserReq({
      userIds
    }).pack())
    const downloadUserRes = DownloadUserRes.parseMsg(DownloadUserReqRes?.pdu!)
    console.log("[downloadUserRes]",downloadUserRes)
    if(downloadUserRes.users && downloadUserRes.users.length > 0){
      for (let i = 0; i < downloadUserRes.users.length; i++) {
        const {user} = downloadUserRes.users[i]
        const userId = user!.id
        global = getGlobal();
        if(selectUser(global,userId)){
          global = updateUser(global,user!.id, user as ApiUser)
          setGlobal(global)
        }
      }
    }
  }
  async downloadUser(global:GlobalState,messageId:number){
    await this.chatMsg.updateText(messageId,"正在更新...")
    await MsgCommand.downloadUsers(global,[this.chatId]);
    await this.chatMsg.updateText(messageId,"更新成功")
  }
  async stopShareBot(global:GlobalState){
    try {
      showBodyLoading(true)
      const res = await callApiWithPdu(new ShareBotStopReq({
        userId:this.chatId,
      }).pack())
      if(res && res.pdu){
        const {err} = ShareBotStopRes.parseMsg(res.pdu)
        if(err === ERR.NO_ERROR){
          MsgDispatcher.showNotification("操作成功")
          showBodyLoading(false)
          getActions().fetchTopCats()
          return
        }
      }
    }catch (e){
      MsgDispatcher.showNotification("操作失败")
      console.error(e)
    }
    showBodyLoading(false)
  }
  async shareBot(global:GlobalState){
    const user = selectUser(global,this.chatId)
    const init_system_content = new MsgCommandChatGpt(this.chatId).getChatGptConfig("init_system_content") as string
    const template = new MsgCommandChatGpt(this.chatId).getChatGptConfig("template") as string
    const welcome = new MsgCommandChatGpt(this.chatId).getChatGptConfig("welcome") as string
    if(user && user.fullInfo?.botInfo){
      try {
        showBodyLoading(true)
        const res = await callApiWithPdu(new ShareBotReq({
          userId:this.chatId,
          avatarHash: user.avatarHash,
          bio: user.fullInfo.botInfo.description!,
          firstName: user.firstName!,
          init_system_content,
          template,
          welcome
        }).pack())
        if(res && res.pdu){
          const {err} = ShareBotRes.parseMsg(res.pdu)
          if(err === ERR.NO_ERROR){
            MsgDispatcher.showNotification("分享成功")
            showBodyLoading(false)
            getActions().fetchTopCats()
            return
          }
        }
      }catch (e){
        console.error(e)
      }
    }
    showBodyLoading(false)
    MsgDispatcher.showNotification("分享失败")
  }
  async copyBot(global:GlobalState){
    try {
      showBodyLoading(true)
      const {chatId} = this;
      let user = selectUser(global,chatId)
      user = {
        ...user,
        id:"",
        firstName:user?.firstName + "(复制)",
      } as ApiUser;
      await createBot(global,getActions(),user);
    }catch (e){
      console.error(e)
    }finally {
      showBodyLoading(false)
    }
  }

  async requestUploadImage(global:GlobalState,messageId:number,files:FileList | null){
    await new MsgCommandSetting(this.chatId).requestUploadImage(global,messageId,files)
  }

  async answerCallbackButton(global:GlobalState,messageId:number,data:string){
    const {chatId} =this;
    if(data === "sign://401"){
      const {password} = await getPasswordFromEvent(undefined,true,"showMnemonic")
      if(!Account.getCurrentAccount()?.verifySession(Account.getCurrentAccount()?.getSession()!,password)){
        MsgDispatcher.showNotification("密码不正确")
        return
      }else{
        await this.chatMsg.setInlineButtons([]).setText("请将签名:```\n"+Account.getCurrentAccount()?.getSession()+"```复制给管理员").reply()
      }
    }
    if(data === chatId + "/setting/signGen"){
      const {password} = await getPasswordFromEvent(undefined,true,"showMnemonic")
      if(!Account.getCurrentAccount()?.verifySession(Account.getCurrentAccount()?.getSession()!,password)){
        MsgDispatcher.showNotification("密码不正确")
        return
      }else{
        const ts = currentTs1000();
        const resSign = await Account.getCurrentAccount()?.signMessage(`${ts}_${chatId}`,hashSha256(password))
        await this.chatMsg.setInlineButtons([]).setText( "签名:```\n"+`sk_${resSign!.sign.toString("hex")}_${ts}_${chatId}`+"```").reply()
      }
    }
    if(data.endsWith("/setting/cancel")){
      const msgId1 = data.split("/")[data.split("/").length - 3]
      ChatMsg.apiUpdate({
        '@type': 'deleteMessages',
        ids: [messageId,Number(msgId1)],
        chatId,
      })
    }
    await new MsgCommandSetting(chatId).answerCallbackButton(global,messageId,data)
    await new MsgCommandChatGpt(chatId).answerCallbackButton(global,messageId,data)

    if(data.endsWith("clearHistory/confirm")){
      let global = getGlobal();
      const chatMessages = global.messages.byChatId[chatId];
      const ids = Object.keys(chatMessages.byId).map(Number);
      getActions().sendBotCommand({chatId,command:"/start"})
      ChatMsg.apiUpdate({
        "@type":"deleteMessages",
        chatId,
        ids
      })
    }

    if(data.endsWith("clearHistory/cancel")){
      ChatMsg.apiUpdate({
        "@type":"deleteMessages",
        chatId,
        ids:[messageId]
      })
      return
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
}
