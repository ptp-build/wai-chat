import {
  ApiAction,
  ApiAudio,
  ApiBotInfo,
  ApiContact,
  ApiDocument,
  ApiFormattedText,
  ApiGame,
  ApiInvoice,
  ApiKeyboardButtons,
  ApiLocation,
  ApiMessage,
  ApiPhoto,
  ApiPoll,
  ApiSticker,
  ApiUpdate,
  ApiUser,
  ApiVideo,
  ApiVoice,
  ApiWebPage,
  OnApiUpdate
} from "../../api/types";
import {currentTs} from "../share/utils/utils";
import {DEFAULT_BOT_COMMANDS, DEFAULT_CHATGPT_AI_COMMANDS} from "../setting";

export default class ChatMsg {
  static _apiUpdate:OnApiUpdate;
  static genMessageId:(isLocal?:boolean)=>number;
  static isWorker:boolean = false
  private chatId: string;
  private id?:number
  private inlineButtons?:ApiKeyboardButtons
  private senderId?:string
  private isOutgoing?:boolean
  private botInfo?:ApiBotInfo
  private content?:{
    text?: ApiFormattedText;
    photo?: ApiPhoto;
    video?: ApiVideo;
    document?: ApiDocument;
    sticker?: ApiSticker;
    contact?: ApiContact;
    poll?: ApiPoll;
    action?: ApiAction;
    webPage?: ApiWebPage;
    audio?: ApiAudio;
    voice?: ApiVoice;
    invoice?: ApiInvoice;
    location?: ApiLocation;
    game?: ApiGame;
  }
  constructor(chatId:string) {
    this.chatId = chatId
  }
  setBotInfo(botInfo:ApiBotInfo){
    this.botInfo = botInfo
  }
  async updateText(id:number,text:string){
    return this.update(id,{
      content: {
        text: {
          text
        }
      }
    })
  }
  setInlineButtons(inlineButtons:ApiKeyboardButtons){
    this.inlineButtons = inlineButtons
    return this
  }
  setThinking(){
    return this.setText("...")
  }
  setText(text:string){
    let {content} = this;
    if(!content){
      content = {
        text:{
          text:""
        }
      }
    }
    if(!content.text){
      content = {
        ...content,
        text:{
          text:""
        }
      }
    }
    this.content = {
      ...content,
      text:{
        ...content.text,
        text,
      }
    }
    return this
  }

  setSenderId(senderId:string){
    this.senderId = senderId
    return this
  }

  async genMsgId(isLocal?:boolean){
    this.id = ChatMsg.genMessageId(isLocal)
    return this.id
  }

  async reply(){
    let {id,chatId,senderId,isOutgoing,content,inlineButtons} = this;
    if(!senderId){
      senderId = chatId
    }
    if(!isOutgoing){
      isOutgoing = false
    }
    if(!id){
      id = await this.genMsgId()
    }
    let message:ApiMessage = {
      chatId,
      id,
      senderId,
      isOutgoing,
      date:currentTs(),
      inlineButtons,
      content:content!,
    }
    return this.sendNewMessage(message)
  }

  async updateMessageSendSucceeded(localId:number,message:ApiMessage){
    ChatMsg.apiUpdate({
      '@type': "updateMessageSendSucceeded",
      localId,
      chatId: this.chatId,
      message: message
    });
    return message
  }
  async update(id:number,message:Partial<ApiMessage>){
    ChatMsg.apiUpdate({
      '@type': "updateMessage",
      id,
      chatId:this.chatId,
      message,
    });
    return message
  }
  async sendNewMessage(message:ApiMessage){
    const id = message.id
    if(!id){
      message.id = await ChatMsg.genMessageId()
    }
    ChatMsg.apiUpdate({
      '@type': "newMessage",
      chatId:this.chatId,
      id,
      message,
      shouldForceReply:false
    });
    return message
  }
  static buildDefaultBotUser({
    userId,firstName,avatarHash,bio,
    init_system_content,welcome,outputText,template,
    photos,
  }:{
    userId:string,firstName:string,bio:string,
    init_system_content?:string,
    avatarHash?:string,
    welcome?:string,
    template?:string,
    outputText?:string,
    photos?:ApiPhoto[]
  }){

    if(!avatarHash){
      avatarHash = ""
    }

    if(!init_system_content){
      init_system_content = ""
    }
    if(!welcome){
      welcome = ""
    }

    if(!template){
      template = ""
    }

    if(!outputText){
      outputText = ""
    }
    return {
      id:userId,
      avatarHash,
      firstName,
      photos:photos || [],
      usernames: [
        {
          "username": "Bot_"+userId,
          "isActive": true,
          "isEditable": true
        }
      ],
      "canBeInvitedToGroup": false,
      "hasVideoAvatar": false,
      "type": "userTypeBot",
      "phoneNumber": "",
      isMin:false,
      noStatus: true,
      isSelf:false,
      accessHash:"",
      isPremium: false,
      fullInfo: {
        "isBlocked": false,
        "noVoiceMessages": false,
        bio,
        botInfo: {
          aiBot:{
            enableAi:true,
            chatGptConfig:{
              init_system_content,
              api_key:"",
              max_history_length:0,
              template,
              welcome,
              outputText,
              modelConfig:{
                model: "gpt-3.5-turbo",
                temperature: 0.5,
                max_tokens: 1000,
                presence_penalty: 0,
              }
            }
          },
          botId: userId,
          "description": bio,
          "menuButton": {
            "type": "commands"
          },
          commands:[...DEFAULT_BOT_COMMANDS,...DEFAULT_CHATGPT_AI_COMMANDS].map(cmd=>{
            // @ts-ignore
            cmd.botId = userId;
            return cmd
          })
        }
      }
    }
  }
  static buildDefaultChat(user:Partial<ApiUser>){
    return {
      "id": user.id,
      "title":  user.firstName,
      "type": "chatTypePrivate",
      "isMuted": false,
      "isMin": false,
      "hasPrivateLink": false,
      "isSignaturesShown": false,
      "isVerified": true,
      "isJoinToSend": true,
      "isJoinRequest": true,
      lastMessage:{
        id:0,
        chatId:user.id,
        isOutgoing:false,
        date:Math.ceil(+(new Date)/1000),
        content:{
          action:{
            type:"chatCreate",
            text:"",
          }
        }
      },
      "isForum": false,
      "isListed": true,
      "settings": {
        "isAutoArchived": false,
        "canReportSpam": false,
        "canAddContact": false,
        "canBlockContact": false
      },
      "accessHash": ""
    }
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
  static apiUpdate(update:ApiUpdate){
    ChatMsg._apiUpdate(update)
  }
  static setApiUpdate(apiUpdate:OnApiUpdate,genMessageId:any){
    ChatMsg._apiUpdate = apiUpdate
    ChatMsg.genMessageId = genMessageId
  }
}
