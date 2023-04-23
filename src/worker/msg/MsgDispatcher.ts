import {
  ApiAttachment,
  ApiBotInfo,
  ApiChat,
  ApiMessage,
  ApiMessageEntity,
  ApiNewPoll,
  ApiSticker,
  ApiUser,
  ApiVideo
} from "../../api/types";
import {getActions, getGlobal} from "../../global";
import {callApiWithPdu} from "./utils";
import {SendBotMsgReq, SendBotMsgRes} from "../../lib/ptp/protobuf/PTPMsg";
import {STOP_HANDLE_MESSAGE, UserIdFirstBot} from "../setting";
import MsgCommandChatGpt from "./MsgCommandChatGpt";
import MsgCommandSetting from "./MsgCommandSetting";
import {selectChatMessage} from "../../global/selectors";
import BotChatGpt from "./bot/BotChatGpt";
import ChatMsg from "./ChatMsg";

export type ParamsType = {
  chat: ApiChat;
  text?: string;
  entities?: ApiMessageEntity[];
  replyingTo?: number;
  attachment?: ApiAttachment;
  sticker?: ApiSticker;
  gif?: ApiVideo;
  poll?: ApiNewPoll;
  isSilent?: boolean;
  scheduledAt?: number;
  sendAs?: ApiChat | ApiUser;
  replyingToTopId?: number;
  groupedId?: string;
  botInfo?: ApiBotInfo
}

export default class MsgDispatcher {
  private params: ParamsType;
  private outGoingMsg?:ApiMessage
  constructor(params: ParamsType) {
    this.params = params;
  }

  static showNotification(message:string){
    getActions().showNotification({message})
  }

  getMsgText(){
    return this.params.text;
  }

  getChatId(){
    return this.params.chat.id;
  }

  getBotInfo(){
    const {botInfo} = this.params;
    return botInfo ? botInfo : undefined
  }

  async sendOutgoingMsg(){
    const chatMsg = new ChatMsg(this.getChatId())
    return chatMsg.setText(this.getMsgText()!)
      .setSenderId(getGlobal().currentUserId!)
      .reply()
  }

  getBotCommands(){
    const {botInfo} = this.params;
    if(botInfo && botInfo.commands){
      const commands: string[] = []
      botInfo.commands.forEach(cmd=>commands.push("/"+cmd.command))
      return commands
    }else{
      return []
    }
  }

  private isMsgCipher() {
    if(this.params.entities){
      return this.params.entities.find(row=>{
        return row && Object.keys(row).includes("cipher")
      })
    }else{
      return false
    }
  }

  async processCmd(){
    const sendMsgText = this.getMsgText();
    const commands = this.getBotCommands();
    if(sendMsgText && commands.includes(sendMsgText)){
      if(this.params.botInfo?.botId === UserIdFirstBot){
        return await this.processFirstBotCmd();
      }
      return await this.processAiBotCmd();
    }
    return true
  }

  async processAiBotCmd(){
    const sendMsgText = this.getMsgText();
    const msgCommandChatGpt = new MsgCommandChatGpt(this.getChatId());

    switch(sendMsgText){
      case "/start":
        return await msgCommandChatGpt.start();
      case "/setting":
        return msgCommandChatGpt.setting()
      case "/reset":
        return await msgCommandChatGpt.reset();
      case "/aiModel":
        return await msgCommandChatGpt.aiModel();
      case "/systemPrompt":
        return await msgCommandChatGpt.systemPrompt();
      case "/apiKey":
        return await msgCommandChatGpt.apiKey();
      case "/maxHistoryLength":
        return await msgCommandChatGpt.maxHistoryLength();
      case "/usage":
        return await msgCommandChatGpt.usage();
      default:
        return await this.processBotApiCmd();
    }
  }
  async processBotApiCmd(){
    const sendMsgText = this.getMsgText();
    let botApi = new MsgCommandChatGpt(this.getChatId()).getAiBotConfig("botApi");
    if(botApi){
      botApi = botApi as string
    }
    if(botApi){
      const res = await callApiWithPdu(new SendBotMsgReq({botApi,chatId:this.getChatId(),text:sendMsgText}).pack())
      if(res){
        const {reply} =  SendBotMsgRes.parseMsg(res.pdu)
        if(reply){
          await new ChatMsg(this.getChatId()).setText(reply).reply()
        }
      }
    }
    return STOP_HANDLE_MESSAGE
  }
  async processFirstBotCmd(){
    const sendMsgText = this.getMsgText();
    const msgCommandSetting = new MsgCommandSetting(this.getChatId());
    switch(sendMsgText){
      case "/start":
        return msgCommandSetting.start()
      case "/setting":
        return await msgCommandSetting.setting();
    }
  }
  async process(){
    let res;
    if(this.getMsgText()?.startsWith("/")){
      this.outGoingMsg = await this.sendOutgoingMsg();
      res = await this.processCmd();
    }
    if(!res){
      try {
        if(!this.isMsgCipher() && this.getBotInfo()){
            if(this.getMsgText() && this.getBotInfo()?.aiBot){
              this.outGoingMsg = await this.sendOutgoingMsg();
              res = await new BotChatGpt(this.getBotInfo()?.botId!).process(this.outGoingMsg)
            }
        }
      }catch (error:any){
        console.error(error)
        if(this.outGoingMsg){
          ChatMsg.apiUpdate({
            '@type': 'updateMessageSendFailed',
            chatId: this.getChatId(),
            localId: this.outGoingMsg.id,
            error: error.message,
          })
        }
      }
    }
    return res
  }
  static async reRunAi(chatId:string,messageId:number,text:string){
    const global = getGlobal();
    const message = selectChatMessage(global,chatId,messageId)
    const {chatGptAskHistory} = global
    const historyList = chatGptAskHistory[chatId]
    let assistantMsgId;
    if(historyList){
      for (let i = 0; i < Object.keys(historyList).length; i++) {
        const msgIdAssistant = parseInt(Object.keys(historyList)[i])
        if(historyList[msgIdAssistant]){
          if(historyList[msgIdAssistant] === messageId){
            assistantMsgId = msgIdAssistant
            break
          }
        }
      }
    }
    let assistantMsg:ApiMessage|undefined
    if(assistantMsgId && message){
      assistantMsg = selectChatMessage(global,chatId,assistantMsgId)
      message.content.text!.text = text
      await new BotChatGpt(chatId).process(message,assistantMsg)
    }
  }
}
