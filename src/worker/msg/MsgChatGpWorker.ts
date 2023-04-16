import {ApiBotInfo, ApiKeyboardButton, ApiKeyboardButtons, ApiMessage, ApiMessageEntityTypes} from "../../api/types";
import {PbChatGptBotConfig_Type} from "../../lib/ptp/protobuf/PTPCommon/types";
import {DEBUG} from "../../config";
import {Message} from "../../../functions/api/types";
import {currentTs, currentTs1000} from "../share/utils/utils";
import {ChatModelConfig, DEFAULT_PROMPT} from "../setting";
import {ControllerPool, requestChatStream} from "../../lib/ptp/functions/requests";
import MsgWorker from "./MsgWorker";
export type AiHistoryType = {
  role:"user"|"system"|"assistant",
  content:string,
  date:string
}
export default class MsgChatGptWorker{
  private botInfo: ApiBotInfo;
  private chatGptConfig: PbChatGptBotConfig_Type | undefined;
  private msgSend: ApiMessage;
  private replyMessage?: ApiMessage;
  private aiHistoryList:AiHistoryType[];
  constructor(msgSend:ApiMessage,botInfo:ApiBotInfo,aiHistoryList?:AiHistoryType[]) {
    this.msgSend = msgSend
    this.botInfo = botInfo
    this.chatGptConfig = this.botInfo.aiBot?.chatGptConfig
    this.aiHistoryList = aiHistoryList||[];
  }
  getPromptContext(){
    if(this.chatGptConfig?.init_system_content){
      return this.chatGptConfig?.init_system_content
    }else{
      return DEFAULT_PROMPT
    }
  }
  getApiKey(){
    if(this.chatGptConfig?.api_key){
      return this.chatGptConfig?.api_key
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

  prepareSendMessages(){
    const text = this.getMsgText();
    const userMessage: Message = {
      role: "user",
      content:text,
      date: new Date(currentTs1000()).toLocaleString(),
    };

    const sendMessages:Message[] = [
      {
        role: "system",
        content: this.getPromptContext(),
        date: "",
      },
      ...this.aiHistoryList,
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
    if(done){
      MsgWorker.onUpdate({
        '@type': "updateGlobalUpdate",
        data:{
          action:"updateAiHistory",
          payload:{
            chatId:this.getChatId(),
            messages:[this.msgSend.id,this.replyMessage.id]
          }
        },
      });
    }
  }
  async process(){
    const apiKey = this.getApiKey();
    if(!apiKey){
      return await this.replyNotApiKey();
    }

    await this.replyThinking()
    requestChatStream(this.prepareSendMessages(), {
      apiKey:this.getApiKey()!,
      modelConfig: this.chatGptConfig?.modelConfig || ChatModelConfig,
      onMessage:(content, done) =>{
        if(!content){
          ControllerPool.remove(parseInt(this.getChatId()), this.replyMessage?.id!);
          this.updateReply("系统错误，请检查 /apiKey 和 /aiModel",[],false)
          ControllerPool.remove(parseInt(this.getChatId()), this.replyMessage?.id!);
          return
        }
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
