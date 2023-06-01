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
import {getActions, getGlobal, setGlobal} from "../../global";
import {callApiWithPdu} from "./utils";
import {SendBotMsgReq, SendBotMsgRes, SendMsgRes, SendTextMsgReq} from "../../lib/ptp/protobuf/PTPMsg";
import {STOP_HANDLE_MESSAGE} from "../setting";
import MsgCommandChatGpt from "./MsgCommandChatGpt";
import {selectChatMessage, selectLastMessageId, selectUser} from "../../global/selectors";
import BotChatGpt from "./bot/BotChatGpt";
import ChatMsg from "./ChatMsg";
import MsgCommand from "./MsgCommand";
import {showModalFromEvent} from "../share/utils/modal";
import {updateUser} from "../../global/reducers";

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
  private outGoingMsg?: ApiMessage;

  constructor(params: ParamsType) {
    this.params = params;
  }

  static showNotification(message: string) {
    getActions()
      .showNotification({message});
  }

  getMsgText() {
    return this.params.text;
  }

  getChatId() {
    return this.params.chat.id;
  }

  getBotInfo() {
    const {botInfo} = this.params;
    return botInfo ? botInfo : undefined;
  }

  async sendOutgoingMsg(isLocalMsgId?:boolean,sendingState?: 'messageSendingStatePending' | 'messageSendingStateFailed') {
    const chatMsg = new ChatMsg(this.getChatId());
    const {replyingTo} = this.params
    let isOutgoing = true;
    const enableAi = new MsgCommandChatGpt(this.getChatId()).getAiBotConfig("enableAi") as boolean;
    if(enableAi){
      isOutgoing = false;
    }
    return chatMsg
      .setText(this.getMsgText()!)
      .setReplyToMessageId(replyingTo)
      .setSenderId(getGlobal().currentUserId!)
      .setSendingState(sendingState)
      .setIsOutgoing(isOutgoing)
      .reply();
  }

  getBotCommands() {
    const {botInfo} = this.params;
    if (botInfo && botInfo.commands) {
      const commands: string[] = [];
      botInfo.commands.forEach(cmd => commands.push("/" + cmd.command));
      return commands;
    } else {
      return [];
    }
  }

  private isMsgCipher() {
    if (this.params.entities) {
      return this.params.entities.find(row => {
        return row && Object.keys(row)
          .includes("cipher");
      });
    } else {
      return false;
    }
  }

  async processCmd() {
    const sendMsgText = this.getMsgText();
    const commands = this.getBotCommands();
    if (sendMsgText && commands.includes(sendMsgText)) {
      return await this.processAiBotCmd();
    }
    return true;
  }

  async processAiBotCmd() {
    const sendMsgText = this.getMsgText();
    const msgCommandChatGpt = new MsgCommandChatGpt(this.getChatId());
    msgCommandChatGpt.setOutGoingMsgId(this.outGoingMsg?.id);

    switch (sendMsgText) {
      case "/start":
        return await msgCommandChatGpt.start();
      case "/help":
        return await msgCommandChatGpt.help();
      case "/usage":
        this.outGoingMsg = await this.sendOutgoingMsg(true);
        return await msgCommandChatGpt.usage(this.outGoingMsg!.id);
      case "/ai":
        return await msgCommandChatGpt.ai();
      case "/prompts":
        return await msgCommandChatGpt.prompts();
      case "/setting":
        this.outGoingMsg = await this.sendOutgoingMsg(true);
        return msgCommandChatGpt.setting(this.outGoingMsg!.id);
      default:
        return await this.processBotApiCmd();
    }
  }

  async processBotApiCmd() {
    const sendMsgText = this.getMsgText();
    let botApi = new MsgCommandChatGpt(this.getChatId()).getAiBotConfig("botApi");
    if (botApi) {
      botApi = botApi as string;
    }
    // if (botApi) {
    //   const res = await callApiWithPdu(new SendBotMsgReq({
    //     botApi,
    //     chatId: this.getChatId(),
    //     text: sendMsgText
    //   }).pack());
    //   if (res) {
    //     const {reply} = SendBotMsgRes.parseMsg(res.pdu);
    //     if (reply) {
    //       await new ChatMsg(this.getChatId()).setText(reply)
    //         .reply();
    //     }
    //   }
    // }
    return STOP_HANDLE_MESSAGE;
  }
  async process() {
    let global = getGlobal();

    const user = selectUser(global,global.currentUserId!)
    if(!this.getMsgText()
      ?.startsWith("/") && user?.firstName === "Me"){
      const {value} = await showModalFromEvent({
        initVal: "",
        title: "昵称",
        placeholder: "开始对话前，请输入你的昵称..."
      });
      if(value){
        global = getGlobal();
        global = updateUser(global,user.id,{firstName:value})
        setGlobal(global);
        MsgCommand.uploadUser(getGlobal(),user.id).catch(console.error)
      }else{
        return STOP_HANDLE_MESSAGE
      }
    }
    const lastMessageId = selectLastMessageId(global,this.getChatId())
    if(lastMessageId){
      console.log("lastMessage",selectChatMessage(global,this.getChatId(),lastMessageId))
    }
    let res;
    if (this.getMsgText()?.startsWith("/")) {
      res = await this.processCmd();
    }
    if (!res) {
      try {
        if (!this.isMsgCipher() && this.getBotInfo()) {
          const msgCommandChatGpt = new MsgCommandChatGpt(this.getChatId());
          const enableAi = msgCommandChatGpt.getAiBotConfig("enableAi") as boolean;
          if (this.getMsgText() && this.getBotInfo()?.aiBot) {
            if (enableAi) {
              this.outGoingMsg = await this.sendOutgoingMsg();
              await new BotChatGpt(this.getChatId()).process(this.outGoingMsg);
              return this.outGoingMsg
            }
          }
          if (this.getMsgText()) {
            this.outGoingMsg = await this.sendOutgoingMsg(false,"messageSendingStatePending");
            return this.handleTextMsg();
          }
        }
      } catch (error: any) {
        console.error(error);
        if (this.outGoingMsg) {
          ChatMsg.apiUpdate({
            '@type': 'updateMessageSendFailed',
            chatId: this.getChatId(),
            localId: this.outGoingMsg.id,
            error: error.message,
          });
        }
      }
    }
    return res;
  }

  async handleBotMsg(botApi: string) {
    const SendBotMsgReqRes = await callApiWithPdu(new SendBotMsgReq({
        botApi,
        chatId: this.getChatId(),
        text: this.getMsgText()
      }
    ).pack());
    if (SendBotMsgReqRes) {
      const {reply} = SendBotMsgRes.parseMsg(SendBotMsgReqRes.pdu);
      if (reply) {
        await new ChatMsg(this.getChatId()).setText(reply)
          .reply();
      }
    }
    return this.outGoingMsg;
  }

  async handleTextMsg() {
    try {
      const {replyingTo} = this.params
      const global = getGlobal()
      let replyToUserId;
      let replyToMsgId;
      if(replyingTo){
        const msg = selectChatMessage(global,this.getChatId(),replyingTo)
        if(msg && msg.senderId && msg.senderId !== this.getChatId() && msg.senderId !== "1"){
          replyToUserId = msg.senderId
          replyToMsgId = msg.id
        }
      }
      const SendTextMsgReqRes = await callApiWithPdu(new SendTextMsgReq({
        chatId: this.getChatId(),
        text: this.getMsgText()!,
        msgId:this.outGoingMsg!.id,
        msgDate:this.outGoingMsg!.date,
        replyToUserId,
        replyToMsgId
      }).pack());
      if (SendTextMsgReqRes) {
        const {replyText,date,senderId,inlineButtons,chatId} = SendMsgRes.parseMsg(SendTextMsgReqRes.pdu);
        await new ChatMsg(this.getChatId()).update(this.outGoingMsg!.id,{
          sendingState:undefined
        })
        if (replyText) {
          await new ChatMsg(chatId).setText(replyText)
            .setInlineButtons()
            .setDate(date).setSenderId(senderId || chatId)
            .reply();
        }
      }
    }catch (e){
      await new ChatMsg(this.getChatId()).update(this.outGoingMsg!.id,{
        sendingState:"messageSendingStateFailed"
      })
    }
    return STOP_HANDLE_MESSAGE;
  }

  static async retryAi(chatId: string, messageAssistantId: number) {
    const global = getGlobal();
    const {chatGptAskHistory} = global;
    const historyList = chatGptAskHistory[chatId];
    if (historyList[messageAssistantId]) {
      const message = selectChatMessage(global, chatId, historyList[messageAssistantId]);
      if (message) {
        await new BotChatGpt(chatId).process(message, selectChatMessage(global, chatId, messageAssistantId));
      }
    }
  }

  static async reRunAi(chatId: string, messageId: number, text: string) {
    const global = getGlobal();
    const message = selectChatMessage(global, chatId, messageId);
    const {chatGptAskHistory} = global;
    const historyList = chatGptAskHistory[chatId];
    let assistantMsgId;
    if (historyList) {
      for (let i = 0; i < Object.keys(historyList).length; i++) {
        const msgIdAssistant = parseInt(Object.keys(historyList)[i]);
        if (historyList[msgIdAssistant]) {
          if (historyList[msgIdAssistant] === messageId) {
            assistantMsgId = msgIdAssistant;
            break;
          }
        }
      }
    }
    let assistantMsg: ApiMessage | undefined;
    if (assistantMsgId && message) {
      assistantMsg = selectChatMessage(global, chatId, assistantMsgId);
      message.content.text!.text = text;
      await new BotChatGpt(chatId).process(message, assistantMsg)
    }
  }
}
