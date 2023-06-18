import {ChatGptStreamStatus} from "../../lib/ptp/protobuf/PTPCommon/types";
import ChatMsg from "./ChatMsg";

let MsgStreamHandlerMap:Record<string, MsgStreamHandler> = {}

export class MsgStreamHandler {
  public streamStatus: ChatGptStreamStatus;
  public reply: string;
  private msgDate: number;
  private msgId: number;
  private chatId: string;
  private replyTextFinal:string;
  private store:Map<string,string>;
  private lastIndex:number;
  private loading:boolean;
  private loadingStop:boolean;
  constructor(chatId:string, msgId:number, msgDate:number,reply:string, streamStatus:ChatGptStreamStatus) {
    this.chatId = chatId;
    this.loading = false
    this.loadingStop = false
    this.lastIndex = 0;
    this.msgId = msgId;
    this.msgDate = msgDate;
    this.reply = reply;
    this.streamStatus = streamStatus;
    this.replyTextFinal = "";
    this.store = new Map();
  }

  checkWords(){
    if(this.loading){
      return
    }
    this.loading = true;
    let i = 0;
    let text_ = ""
    while (true){
      i += 1;
      if(!this.store.has(i.toString())){
        break
      }
      const text = this.store.get(i.toString())
      text_ += text
      if(!this.store.has((i+1).toString())){
        break
      }
    }
    // console.log("checkWords", text_,this.store)
    if(text_){
      if(!this.loadingStop){
        this.sendReply(text_).catch(console.error)

      }
    }
    this.loading = false;

  }
  static getInstance(chatId:string, msgId:number, msgDate:number,reply:string, streamStatus:ChatGptStreamStatus){
    const key = `${chatId}_${msgId}_${msgDate}`
    if(!MsgStreamHandlerMap[key]){
      MsgStreamHandlerMap[key] = new MsgStreamHandler(chatId, msgId, msgDate,reply, streamStatus)
    }else{
      MsgStreamHandlerMap[key].reply = reply
      MsgStreamHandlerMap[key].streamStatus = streamStatus
    }
    return MsgStreamHandlerMap[key]
  }

  static removeInstance(chatId:string, msgId:number, msgDate:number){
    const key = `${chatId}_${msgId}_${msgDate}`
    if(MsgStreamHandlerMap[key]){
      delete MsgStreamHandlerMap[key]
    }
  }

  async processReplyText(){
    const i = this.reply.indexOf("_")
    if(i > 0){
      const index = parseInt(this.reply.substring(0,i))

      this.lastIndex = index
      const text = this.reply.substring(i + 1)
      // console.log("===> 11 ",index,text)
      this.store.set(index.toString(),text)
    }
  }
  async process(){
    if(this.streamStatus === ChatGptStreamStatus.ChatGptStreamStatus_START){
      // return await this.sendReply("...")
    }
    if(this.streamStatus === ChatGptStreamStatus.ChatGptStreamStatus_ERROR){
      this.loadingStop = true
      this.store.clear()
      return await this.sendReply(this.reply)
    }

    if(this.streamStatus === ChatGptStreamStatus.ChatGptStreamStatus_GOING){
      await this.processReplyText()
      this.checkWords()
    }

    if(this.streamStatus === ChatGptStreamStatus.ChatGptStreamStatus_DONE){
      MsgStreamHandler.removeInstance(this.chatId,this.msgId,this.msgDate);
      this.loadingStop = true
      // console.log("===> done",this.reply)
      this.store.clear()
      return await this.sendReply(this.reply.substring( this.reply.indexOf("_") + 1))
    }
  }
  async sendReply(text:string){
    await new ChatMsg(this.chatId!).update(this.msgId, {
      content: {
        text: {
          text: text
        }
      }
    });
  }
}
