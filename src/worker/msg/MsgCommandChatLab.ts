import MsgDispatcher from "./MsgDispatcher";
import {ApiBotInfo, ApiKeyboardButtons, ApiMessage} from "../../api/types";
import {DEFAULT_BOT_COMMANDS, UserIdChatGpt, UserIdCnPrompt, UserIdEnPrompt, UserIdFirstBot} from "../setting";
import {GlobalState} from "../../global/types";
import {showModalFromEvent} from "../share/utils/modal";
import {getActions, getGlobal, setGlobal} from "../../global";
import {currentTs} from "../share/utils/utils";
import {DEBUG} from "../../config";
import {selectChatMessage} from "../../global/selectors";
import {updateChat} from "../../global/reducers";

export default class MsgCommandChatLab{
  private chatId: string;
  private botInfo: ApiBotInfo;
  constructor(chatId:string,botInfo:ApiBotInfo) {
    this.chatId = chatId
    this.botInfo = botInfo;
  }
  static getInlineButtonsDemo():ApiKeyboardButtons{
    return [

      [
        {
          text:"command button",
          type:'command'
        },
        {
          text:"unsupported button",
          type:'unsupported'
        },
        {
          text:"buy button",
          type:'buy'
        }
      ],
      [
        {
          text:"game button",
          type:'game'
        },
        {
          text:"requestPhone button",
          type:'requestPhone'
        }
      ],
      [
        {
          text:"receipt button",
          type:'receipt',
          receiptMessageId:1
        },
      ],
      [
        {
          text:"url button",
          type:'url',
          url:"http://www.ai.com"
        },
      ],
      [
        {
          text:"simpleWebView button",
          type:'simpleWebView',
          url:"http://www.ai.com"
        },
        {
          text:"webView button",
          type:'webView',
          url:"http://www.ai.com"
        },
      ],
      [
        {
          text:"requestPoll button",
          type:'requestPoll',
          isQuiz:true
        },
        {
          text:"switchBotInline button",
          type:'switchBotInline',
          query: "",
          isSamePeer: false
        },
        {
          text:"userProfile button",
          type:'userProfile',
          userId: UserIdFirstBot,
        },
      ],
      [
        {
          text:"requestUploadImage button",
          type:'requestUploadImage',
        },
      ]
    ]
  }
  static async createChat(botId:string,data:string,msgId:number){
    const t = data.split("/")
    const chatId = t[0]
    const title = t[3]
    const message = selectChatMessage(getGlobal(),chatId,msgId)
    if(message){
      const prompt = message.content.text!.text
      getActions().createChat({title,promptInit:prompt})
    }
  }
  static async createChatGpt(chatId:string,id:string){
    let name = "ChatGpt";
    let needCreate = true;
    let global = getGlobal();
    if(global.chats.byId[id]){
      const chat = global.chats.byId[id];
      if(chat.isNotJoined){
        delete global.chats.byId[id]
        delete global.users.byId[id]
        setGlobal(global)
      }else{
        needCreate = false
      }
    }
    if(!needCreate){
      getActions().openChat({id,shouldReplaceHistory:true})
      return MsgDispatcher.showNotification(`${name} 已创建`)
    }
    getActions().createChat({id,title:name})
  }
  static async createPromptChat(chatId:string,id:string){
    let name: string;
    const prompts = require('./prompts.json')
    let tag: string;
    if(id === UserIdEnPrompt){
      name = "英文Prompt大全"
      tag = 'en'
    }else{
      name = "中文Prompt大全"
      tag = 'cn'
    }
    let needCreate = true;
    let global = getGlobal();
    if(global.chats.byId[id]){
      const chat = global.chats.byId[id];
      if(chat.isNotJoined){
        delete global.chats.byId[id]
        delete global.users.byId[id]
        setGlobal(global)
      }else{
        needCreate = false
      }
    }
    if(!needCreate){
      getActions().openChat({id,shouldReplaceHistory:true})
      return MsgDispatcher.showNotification(`${name} 已创建`)
    }
    const promptRows = prompts[tag]
    getActions().createChat({id,title:name})
    const msg0 = await MsgDispatcher.newTextMessage(chatId,undefined,"正在创建 "+name+"...")
    setTimeout(async ()=>{
      promptRows.reverse();
      for (let i = 0; i < promptRows.length; i++) {
        const desc = promptRows[i][1]
        const title = promptRows[i][0]
        if(desc){
          await MsgDispatcher.newTextMessage(id,undefined,desc,[
            [
              {
                text:"创建Gpt聊天",
                type:"callback",
                data:`${id}/createChat/${tag}/${title}`
              }
            ]
          ])
          await MsgDispatcher.updateMessage(chatId,msg0.id,{
            ...msg0,
            content:{
              text:{
                text:`正在创建 ${name}... ${i+1}/${promptRows.length}`
              }
            }
          })
        }

      }
    },500)
  }
  static async answerCallbackButton(global:GlobalState,chatId:string,messageId:number,data:string){

    if(data.startsWith(`${chatId}/createChat/cn`)){
      await MsgCommandChatLab.createChat(UserIdCnPrompt,data,messageId)
      return
    }
    if(data.startsWith(`${chatId}/createChat/en`)){
      await MsgCommandChatLab.createChat(UserIdEnPrompt,data,messageId)
      return
    }
    switch (data){
      case `${chatId}/lab/createChatGpt`:
        await MsgCommandChatLab.createChatGpt(chatId,UserIdChatGpt)
        break
      case `${chatId}/lab/createEnPrompt`:
        await MsgCommandChatLab.createPromptChat(chatId,UserIdEnPrompt)
        break
      case `${chatId}/lab/createCnPrompt`:
        await MsgCommandChatLab.createPromptChat(chatId,UserIdCnPrompt)
        break
      case `${chatId}/lab/InlineButs`:
        await MsgDispatcher.newTextMessage(chatId,undefined,"",MsgCommandChatLab.getInlineButtonsDemo())
        break

      case `${chatId}/lab/dumpUsers`:
        if(DEBUG){
          await MsgDispatcher.newCodeMessage(chatId,undefined,JSON.stringify(global.messages.byChatId[chatId],null,2))
        }
        break
      case `${chatId}/lab/testMsg`:
        const {value} = await showModalFromEvent({
          title: "输入JSON 格式的 msg", type: "singleInput"
        })
        try {
          if(value){
            const testMsg = async (value:string)=>{
              const message:ApiMessage = JSON.parse(value);
              message.chatId = chatId;
              message.id = await MsgDispatcher.genMsgId();
              message.isOutgoing = false
              message.senderId = chatId
              message.date = currentTs()
              await MsgDispatcher.newMessage(chatId,message.id,message)
            }
            await testMsg(value);
          }
        }catch (e){
          getActions().showNotification({
            message:"解析失败"
          })
        }
        break
    }
  }
  async lab(){
    const messageId = await MsgDispatcher.genMsgId();
    return await MsgDispatcher.newTextMessage(this.chatId,messageId,"实验室",[
      [
        {
          data:`${this.chatId}/lab/createChatGpt`,
          text:"创建ChatGpt机器人",
          type:"callback"
        },
      ],
      [
        {
          data:`${this.chatId}/lab/createCnPrompt`,
          text:"中文Prompt大全",
          type:"callback"
        },
      ],
      [
        {
          data:`${this.chatId}/lab/createEnPrompt`,
          text:"英文Prompt大全",
          type:"callback"
        },
      ],
      // [
      //   {
      //     data:`${this.chatId}/lab/dumpUsers`,
      //     text:"DumpUsers",
      //     type:"callback"
      //   },
      // ],
      // [
      //   {
      //     data:`${this.chatId}/lab/InlineButs`,
      //     text:"InlineButs Demo",
      //     type:"callback"
      //   },
      // ],
        // [
        //   {
        //     data:`${this.chatId}/temp/PromptDemo`,
        //     text:"PromptDemo",
        //     type:"callback"
        //   },
        // ],
    ])
  }

}
