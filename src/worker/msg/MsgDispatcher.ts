import {
  ApiAttachment,
  ApiBotInfo,
  ApiChat,
  ApiFormattedText,
  ApiKeyboardButtons,
  ApiMessage,
  ApiMessageEntity,
  ApiNewPoll,
  ApiSticker,
  ApiUser,
  ApiVideo
} from "../../api/types";
import {GlobalState} from "../../global/types";
import {getActions, getGlobal, setGlobal} from "../../global";
import {callApiWithPdu} from "./utils";
import {currentTs} from "../share/utils/utils";
import {GenMsgIdReq, GenMsgIdRes, SendReq} from "../../lib/ptp/protobuf/PTPMsg";
import MsgCommand from "./MsgCommand";
import {parseCodeBlock} from "../share/utils/stringParse";
import MsgWorker from "./MsgWorker";
import {DEFAULT_AI_CONFIG_COMMANDS, DEFAULT_BOT_COMMANDS, UserIdFirstBot} from "../setting";
import MsgCommandChatGpt from "./MsgCommandChatGpt";
import MsgCommandSetting from "./MsgCommandSetting";
import {selectUser} from "../../global/selectors";
import MsgCommandChatLab from "./MsgCommandChatLab";
import BotWebSocket from "./bot/BotWebSocket";

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
export type OptionsType = {
  senderId?:string,
  inlineButtons?:ApiKeyboardButtons
  isLocalMessageId?:boolean,
}

export default class MsgDispatcher {
  private params: ParamsType;
  private global: GlobalState;
  private msgCommand: MsgCommand;
  constructor(global:GlobalState,params: ParamsType) {
    this.global = global;
    this.params = params;
    this.msgCommand = new MsgCommand(this)
  }

  static apiUpdate(update:any){
    const {apiUpdate} = getActions()
    apiUpdate(update)
  }
  getMsgSenderAsId(){
    return this.params.sendAs?.id;
  }
  getMsgText(){
    return this.params.text;
  }

  getChatId(){
    return this.params.chat.id;
  }
  genMsgDate(){
    return Math.ceil(+(new Date())/1000);
  }

  static async genMsgId(isLocal?:boolean){
    // @ts-ignore
    const {pdu} = await callApiWithPdu(new GenMsgIdReq({isLocal:!!isLocal}).pack())
    const {messageId} = GenMsgIdRes.parseMsg(pdu)
    return messageId
  }

  updateMessageSendSucceeded(localId:number,message:ApiMessage){
    MsgDispatcher.apiUpdate({
      '@type': "updateMessageSendSucceeded",
      localId,
      chatId: this.params.chat.id,
      message: message
    });
  }
  updateMessageText(id:number,{text}:{text: any},message:ApiMessage){
    this.updateMessage(id,{
      ...message,
      content:{
        ...message.content,
        text: {
          ...message.content.text,
          text
        }
      }
    })
  }
  updateMessage(id:number,message:Partial<ApiMessage>){
    return MsgDispatcher.updateMessage(this.getChatId(),id,message)
  }
  static updateMessage(chatId:string,messageId:number,message:Partial<ApiMessage>){
    message = MsgWorker.handleMessageTextCode(message)
    MsgDispatcher.apiUpdate({
        '@type': "updateMessage",
        id: messageId,
        chatId,
        message,
      });
    return message
  }
  static async newCodeMessage(chatId:string,messageId?:number,text?:string){
    text = "```\n"+text!+"```"
    return await MsgDispatcher.newTextMessage(chatId,messageId,text,[])
  }

  static async newJsonMessage(chatId:string,messageId?:number,json?:object){
    const text = "```json\n"+JSON.stringify(json,null,2)!+"```"
    return await MsgDispatcher.newTextMessage(chatId,messageId,text,[])
  }

  static async newTextMessage(chatId:string,messageId?:number,text?:string,inlineButtons?:ApiKeyboardButtons,options?:{isOutgoing?:boolean}){
    if(!messageId){
      messageId = await MsgDispatcher.genMsgId();
    }
    const global = getGlobal();
    const user = selectUser(global,chatId)
    let message:Partial<ApiMessage> = {
      chatId,
      id:messageId,
      senderId:chatId,
      isOutgoing:false,
      date:currentTs(),
      inlineButtons,
      content:{
        text:{
          text:text||""
        }
      },
      ...options
    }
    message = MsgWorker.handleMessageTextCode(message)
    if(user && user.fullInfo?.botInfo){
      message = MsgWorker.handleBotCmdText(message,user.fullInfo?.botInfo)
    }
    MsgDispatcher.apiUpdate({
      '@type': "newMessage",
      chatId,
      id:messageId,
      message,
      shouldForceReply:false
    });
    return MsgDispatcher.newMessage(chatId,messageId,message)
  }
  static newMessage(chatId:string,messageId:number,message:ApiMessage){
    const global = getGlobal();
    const user = selectUser(global,chatId)
    if(user && user.fullInfo?.botInfo){
      message = MsgWorker.handleBotCmdText(message,user.fullInfo?.botInfo)
    }
    MsgDispatcher.apiUpdate({
      '@type': "newMessage",
      chatId,
      id:messageId,
      message,
      shouldForceReply:false
    });
    return message
  }
  async sendNewMessage(content:{text?:ApiFormattedText},options:OptionsType){
    const {isLocalMessageId,senderId,inlineButtons} = options || {}
    const id = await MsgDispatcher.genMsgId(!!isLocalMessageId)
    const message = {
      id,
      content,
      inlineButtons,
      chatId: this.getChatId(),
      date: this.genMsgDate(),
      senderId:this.getMsgSenderAsId(),
      isOutgoing:(senderId || this.getMsgSenderAsId()) !== this.getChatId(),
      sendingState: undefined
    }
    if(this.params.botInfo){
      MsgWorker.handleBotCmdText(message,this.params.botInfo)
    }
    return MsgDispatcher.newMessage(this.getChatId(),id,message)
  }
  async sendNewTextMessage({text,options}:{text?:string,options?:OptionsType}){
    const res = parseCodeBlock(text!)
    // @ts-ignore
    return await this.sendNewMessage({text:res!,},options)
  }

  async replyText(text:string){
    return await this.replyNewTextMessage({text})
  }

  async replyCode(text:string){
    return await this.replyNewTextMessage({text:"```\n"+text+"```"})
  }

  async replyNewTextMessage({text,options}:{text?:string,options?:OptionsType}){
    return await this.sendNewTextMessage({text,options:{
      ...options,
        senderId:this.getChatId()
      }})

  }
  async sendOutgoingMsg(){
    return await this.sendNewTextMessage({
      text: this.getMsgText(),
    })
  }
  static buildMsgHistoryClear(chatId:string):ApiMessage{
    return {
      id: 0,
      chatId,
      isOutgoing: false,
      date: currentTs(),
      content: {
        action: {
          text: "历史记录已清空",
          type: 'historyClear',
          translationValues:[],
        }
      }
    }
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
  getBot(){
    const {botInfo} = this.params;
    return botInfo
  }

  getBotConfig(){
    const {botInfo} = this.params;
    return botInfo ? botInfo.aiBot : undefined
  }

  async processCmd(){
    const sendMsgText = this.getMsgText();
    const commands = this.getBotCommands();
    console.log("processCmd",this.params.chat.id,sendMsgText,commands)
    if(sendMsgText && commands.includes(sendMsgText)){
      if(this.params.botInfo?.botId === UserIdFirstBot){
        return await this.processFirstBotCmd();
      }
      if(this.params.botInfo?.aiBot?.chatGptConfig){
        return await this.processAiBotCmd();
      }
    }
    return true
  }

  async processAiBotCmd(){
    const sendMsgText = this.getMsgText();
    const msgCommandChatGpt = new MsgCommandChatGpt(this.getChatId(),this.params.botInfo!);
    if(sendMsgText !== "/apiKey"){
      await this.sendOutgoingMsg();
    }

    switch(sendMsgText){
      case "/start":
        return await msgCommandChatGpt.start();
      case "/setting":
        return msgCommandChatGpt.setting()
      case "/enableAi":
        return await msgCommandChatGpt.enableAi();
      case "/aiModel":
        return await msgCommandChatGpt.aiModel();
      case "/initPrompt":
        return await msgCommandChatGpt.initPrompt();
      case "/apiKey":
        return await msgCommandChatGpt.apiKey();
      default:
        return true;
    }
  }
  async processFirstBotCmd(){
    const sendMsgText = this.getMsgText();
    switch(sendMsgText){
      case "/start":
        await this.sendOutgoingMsg();
        return MsgCommandSetting.start(this.getChatId())
      case "/lab":
        return await new MsgCommandChatLab(this.getChatId(),this.params.botInfo!).lab();
      case "/setting":
        return await this.msgCommand.setting();
      default:
        return await this.sendOutgoingMsg();
    }
  }
  async process(){
    let res;
    console.log("process",this.getChatId(),this.getMsgText(),this.global.chats.byId[this.getChatId()])
    if(this.getMsgText()?.startsWith("/")){
      res = await this.processCmd();
    }
    // if(!res && this.getBot()){
    //   res = await this.handleWsBot();
    // }
    return res
  }
  async handleWsBot(){
    const config = this.getBotConfig();
    if(config && config.botApi){
      const wsBot = BotWebSocket.getInstance(this.getChatId())
      if(wsBot){
        if(!wsBot.isConnect()){
          await MsgCommand.createWsBot(this.getChatId())
        }
        if(wsBot.isConnect()){
          wsBot.send(new SendReq({
            chatId:this.getChatId(),
            text:this.getMsgText()
          }).pack().getPbData())
        }
        return await this.sendOutgoingMsg();
      }
    }
  }
  static showNotification(message:string){
    getActions().showNotification({message})
  }
}
