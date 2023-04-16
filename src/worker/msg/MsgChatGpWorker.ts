import {ApiBotInfo, ApiKeyboardButton, ApiKeyboardButtons, ApiMessage, ApiMessageEntityTypes} from "../../api/types";
import {PbChatGpBotConfig_Type} from "../../lib/ptp/protobuf/PTPCommon/types";
import {DEBUG} from "../../config";
import {Message} from "../../../functions/api/types";
import {currentTs, currentTs1000} from "../share/utils/utils";
import {ChatModelConfig, DEFAULT_PROMPT} from "../setting";
import {ControllerPool, requestChatStream} from "../../lib/ptp/functions/requests";
import MsgWorker from "./MsgWorker";

export default class MsgChatGptWorker{
  private botInfo: ApiBotInfo;
  private setting: PbChatGpBotConfig_Type | undefined;
  private msgSend: ApiMessage;
  private replyMessage?: ApiMessage;
  constructor(msgSend:ApiMessage,botInfo:ApiBotInfo) {
    this.msgSend = msgSend
    this.botInfo = botInfo
    this.setting = this.botInfo.aiBot?.chatGptConfig
  }
  getPromptContext(){
    if(this.setting?.init_system_content){
      return this.setting?.init_system_content
    }else{
      return DEFAULT_PROMPT
    }
  }
  getApiKey(){
    if(this.setting?.api_key){
      return this.setting?.api_key
    }else{
      if(DEBUG && process.env.OPENAI_APIKEY){
        return process.env.OPENAI_APIKEY
      }else{
        return undefined
      }
    }
  }
  getMsgText(){
    return this.msgSend.content.text?.text!
  }
  isMsgCipher(){
    return this.msgSend.content.text?.entities?.some((e) => e.type === ApiMessageEntityTypes.Spoiler);
  }
  prepareSendMessages(){
    const text = this.getMsgText();
    const userMessage: Message = {
      role: "user",
      content:text,
      date: new Date(currentTs1000()).toLocaleString(),
    };

    const botMessage: Message = {
      content: "",
      role: "assistant",
      date: new Date().toLocaleString(),
      streaming: true,
    };

    const sendMessages:Message[] = [
      {
        role: "system",
        content: this.getPromptContext(),
        date: "",
      },
      userMessage
    ]
    return sendMessages
  }
  getChatId(){
    return this.msgSend.chatId;
  }
  async reply(text:string){
    const msgId = await MsgWorker.genMessageId();
    this.replyMessage = {
      id:msgId,
      chatId:this.getChatId(),
      date:currentTs(),
      isOutgoing:false,
      sendingState: undefined,
      senderId:this.getChatId(),
      content:{
        text:{
          text
        }
      }
    }
    this.replyMessage = MsgWorker.handleBotCmdText(this.replyMessage,this.botInfo)
    MsgWorker.newMessage(this.getChatId(),msgId,this.replyMessage)
  }

  async replyNotApiKey(){
    await this.reply("还没有配置 请点击 /apiKey 进行配置")
  }
  async replyThinking(){
    await this.reply("...")
  }

  updateReply(content:string,inlineButtons:ApiKeyboardButtons,done:boolean,error?:boolean){
    let message:ApiMessage = {
      ...this.replyMessage!,
      content: {
        text: {
          text: content
        }
      },
      inlineButtons,
    }

    message = MsgWorker.handleMessageTextCode(message);
    message = MsgWorker.handleBotCmdText(message,this.botInfo)
    this.replyMessage = message
    MsgWorker.updateMessage(this.getChatId(),this.replyMessage!.id,message)
  }
  async process(){
    const apiKey = this.getApiKey();
    if(!apiKey){
      return await this.replyNotApiKey();
    }
    if(this.isMsgCipher()){
      return
    }
    await this.replyThinking()
    requestChatStream(this.prepareSendMessages(), {
      apiKey:this.getApiKey()!,
      modelConfig: this.setting?.config || ChatModelConfig,
      onMessage:(content, done) =>{
        if(done){
          this.updateReply(content,[],done)
          ControllerPool.remove(parseInt(this.getChatId()), this.replyMessage?.id!);
        }else{
          this.updateReply(content,[
            [
              {
                text:"停止输出",
                data:`${this.getChatId()}/requestChatStream/stop`,
                type:"callback"
              }
            ]
          ],done)
        }
      },
      onAbort:(error) =>{
        const text = this.replyMessage?.content.text?.text! === "..." ? error.message : this.replyMessage?.content.text?.text!
        this.updateReply(this.replyMessage?.content.text?.text!,[
          [
            {
              text:"已停止输出",
              type:"unsupported"
            }
          ]
        ],true,true)
        ControllerPool.remove(parseInt(this.getChatId()), this.replyMessage?.id!);
      },
      onError:(error) =>{
        this.updateReply(error.message,[],true,true)
        ControllerPool.remove(parseInt(this.getChatId()), this.replyMessage?.id!);
      },
      onController:(controller) =>{
        ControllerPool.addController(
          parseInt(this.getChatId()),
          this.replyMessage?.id!,
          controller,
        );
      },
    }).catch(console.error);
  }
}
