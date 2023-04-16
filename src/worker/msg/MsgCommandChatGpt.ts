import MsgDispatcher from "./MsgDispatcher";
import {currentTs} from "../share/utils/utils";
import {ApiBotInfo, ApiKeyboardButtons, ApiMessage} from "../../api/types";
import {GlobalState} from "../../global/types";
import {getGlobal, setGlobal} from "../../global";
import {selectUser} from "../../global/selectors";
import {updateUser} from "../../global/reducers";
import {AI_START_TIPS, DEFAULT_AI_CONFIG_COMMANDS} from "../setting";
import {callApiWithPdu} from "./utils";
import {StopChatStreamReq} from "../../lib/ptp/protobuf/PTPOther";
import Account from "../share/Account";
import MsgCommand from "./MsgCommand";
import {showModalFromEvent} from "../share/utils/modal";
import {PbAiBot_Type, PbChatGpBotConfig_Type} from "../../lib/ptp/protobuf/PTPCommon/types";

export default class MsgCommandChatGpt{
  private chatId: string;
  private botInfo: ApiBotInfo;
  constructor(chatId:string,botInfo:ApiBotInfo) {
    this.chatId = chatId
    this.botInfo = botInfo;
  }
  static getInlineButtons(chatId:string,isEnableSync:boolean):ApiKeyboardButtons{
    const global = getGlobal();
    const disableClearHistory = MsgCommandChatGpt.getAiBotConfig(global,chatId,'disableClearHistory')
    return isEnableSync ? [
      [
        {
          data:`${chatId}/setting/uploadUser`,
          text:"上传机器人",
          type:"callback"
        },
        {
          data:`${chatId}/setting/downloadUser`,
          text:"更新机器人",
          type:"callback"
        },
      ],
      // [
      //   {
      //     data:`${chatId}/setting/createBotWs`,
      //     text:"使用BotApi",
      //     type:"callback"
      //   },
      // ],
      [
        ...MsgCommand.buildInlineCallbackButton(chatId,'setting/ai/reloadCommands',"重载命令"),
        ...MsgCommand.buildInlineCallbackButton(chatId,'setting/ai/toggleClearHistory',disableClearHistory ? "允许清除历史记录":"关闭清除历史记录"),
        ...(disableClearHistory ? [] : MsgCommand.buildInlineCallbackButton(chatId,'setting/ai/clearHistory',"清除历史记录")),
      ],
    ]:[
      [
        ...MsgCommand.buildInlineCallbackButton(chatId,'setting/ai/reloadCommands',"重载命令"),
        ...MsgCommand.buildInlineCallbackButton(chatId,'setting/ai/toggleClearHistory',disableClearHistory ? "允许清除历史记录":"关闭清除历史记录"),
        ...(disableClearHistory ? [] : MsgCommand.buildInlineCallbackButton(chatId,'setting/ai/clearHistory',"清除历史记录")),

      ],
    ]
  }

  static async toggleClearHistory(chatId:string,messageId:number){
    const global = getGlobal();
    const disableClearHistory = MsgCommandChatGpt.getAiBotConfig(global,chatId,'disableClearHistory')
    await MsgCommandChatGpt.changeAiBotConfig(global,chatId,{
      "disableClearHistory":!disableClearHistory
    })
    const isEnableSync = Account.getCurrentAccount()?.getSession();
    await MsgDispatcher.updateMessage(chatId,messageId,{
      inlineButtons:MsgCommandChatGpt.getInlineButtons(chatId,!!isEnableSync)
    })
  }
  async setting(){
    const {chatId} = this;
    const account = Account.getCurrentAccount();
    const isEnableSync = account?.getSession();
    const messageId = await MsgDispatcher.genMsgId();
    const text = `设置面板`
    return MsgDispatcher.newMessage(chatId,messageId,{
      chatId,
      id:messageId,
      senderId:chatId,
      isOutgoing:false,
      date:currentTs(),
      content:{
        text:{
          text
        }
      },
      inlineButtons:MsgCommandChatGpt.getInlineButtons(chatId,!!isEnableSync),
    })
  }
  async start(){
    const messageId = await MsgDispatcher.genMsgId();
    const {chatId} = this
    const message = {
      chatId,
      id:messageId,
      senderId:chatId,
      isOutgoing:false,
      date:currentTs(),
      content:{
        text:{
          text:AI_START_TIPS
        }
      },
    }
    MsgDispatcher.newMessage(chatId,messageId,message)
    return message
  }
  async initPrompt(){
    const messageId = await MsgDispatcher.genMsgId();
    const {chatId} = this
    const init_system_content = MsgCommandChatGpt.getChatGptConfig(getGlobal(),chatId,"init_system_content")

    const message:ApiMessage = {
      chatId,
      id:messageId,
      senderId:chatId,
      isOutgoing:false,
      date:currentTs(),
      content:{
        text:{
          text:`${init_system_content?init_system_content:"未设置"}`
        }
      },
      inlineButtons:[
        [
          {
            text:"点击修改 Prompt",
            type:"callback",
            data:`${chatId}/init_system_content`
          }
        ]
      ]
    }
    MsgDispatcher.newMessage(chatId,messageId,message)
    return message
  }

  static getAiBotConfig(global:GlobalState,chatId:string,key:'enableAi'|'botApi'|'chatGptConfig'|'disableClearHistory'){
    const user = selectUser(global,chatId);
    if(
      user?.fullInfo &&
      user?.fullInfo.botInfo &&
      user?.fullInfo.botInfo.aiBot
    ){
      return user?.fullInfo.botInfo.aiBot[key]
    }else{
      return undefined
    }
  }
  static getChatGptConfig(global:GlobalState,chatId:string,key:'api_key'|'init_system_content'){
    const user = selectUser(global,chatId);
    // @ts-ignore
    const aiBotConfig:PbChatGpBotConfig_Type = MsgCommandChatGpt.getAiBotConfig(global,chatId,"chatGptConfig")
    if(aiBotConfig && aiBotConfig[key]){
      return aiBotConfig[key]
    }else{
      return ""
    }
  }
  static changeAiBotConfig(global:GlobalState,botId:string,aiConfig:Partial<PbAiBot_Type>){
    global = getGlobal();
    const user = selectUser(global,botId);
    global = updateUser(global,botId,{
      ...user,
      fullInfo:{
        ...user?.fullInfo,
        botInfo:{
          ...user?.fullInfo?.botInfo!,
          aiBot:{
            ...user?.fullInfo?.botInfo?.aiBot,
            ...aiConfig
          }
        }
      }
    })
    setGlobal(global)
  }
  static changeChatGptConfig(botId:string,chatGptConfig:Partial<PbChatGpBotConfig_Type>){
    let global = getGlobal();
    const user = selectUser(global,botId);

    MsgCommandChatGpt.changeAiBotConfig(global,botId,{
      ...user?.fullInfo?.botInfo?.aiBot,
      chatGptConfig:{
        ...user?.fullInfo?.botInfo?.aiBot?.chatGptConfig,
        ...chatGptConfig
      }
    })
  }
  async apiKey(){
    const {chatId} = this
    const api_key = MsgCommandChatGpt.getChatGptConfig(getGlobal(),chatId,"api_key")
    const {value} = await showModalFromEvent({
      initVal:api_key,
      title:"请输入apiKey"
    })
    if(value && value!== api_key){
      localStorage.setItem("cg-key",value)
      MsgCommandChatGpt.changeChatGptConfig(chatId,{api_key:value})
      return await MsgDispatcher.newTextMessage(chatId,undefined,'修改成功')
    }
    return true
  }
  async aiModel(){
    const messageId = await MsgDispatcher.genMsgId();
    const {chatId} = this
    const model = this.botInfo.aiBot?.chatGptConfig?.config?.model
    const message:ApiMessage = {
      chatId,
      id:messageId,
      senderId:chatId,
      isOutgoing:false,
      date:currentTs(),
      content:{
        text:{
          text:`当前模型:【${model}】`
        }
      },
    }
    MsgDispatcher.newMessage(chatId,messageId,message)
    return message
  }
  async enableAi(){
    const messageId = await MsgDispatcher.genMsgId();
    const {chatId} = this
    const isEnable = !!this.botInfo.aiBot?.enableAi
    const message:ApiMessage = {
      chatId,
      id:messageId,
      senderId:chatId,
      isOutgoing:false,
      date:currentTs(),
      content:{
        text:{
          text:`当前AI状态:【${isEnable ? "开启" : "关闭"}】，修改请点击下面按钮:`
        }
      },
      inlineButtons:[
        [
          {
            text:isEnable ? "关闭" : "开启",
            type:"callback",
            data:`${chatId}/enableAi/${isEnable ? "0":"1"}`
          }
        ]
      ]
    }
    MsgDispatcher.newMessage(chatId,messageId,message)
    return message
  }
  static async createBotWs(chatId:string){
    let global = getGlobal();
    // @ts-ignore
    let botApi:string | undefined = MsgCommandChatGpt.getAiBotConfig(global,chatId,"botApi")
    const res = await showModalFromEvent({
      type:"singleInput",
      title:"请输入 网址",
      placeholder:"",
      initVal:botApi
    });
    let {value} = res
    if(botApi !== value){
      botApi = value
      MsgCommandChatGpt.changeAiBotConfig(global,chatId,{
        botApi:value || ""
      })
    }
    if(botApi){
      await MsgCommand.createWsBot(chatId)
    }
  }
  static async answerCallbackButton(global:GlobalState,chatId:string,messageId:number,data:string){
    switch (data){
      case `${chatId}/setting/ai/toggleClearHistory`:
        await MsgCommandChatGpt.toggleClearHistory(chatId,messageId)
        return
      case `${chatId}/setting/createBotWs`:
        await MsgCommandChatGpt.createBotWs(chatId)
        return
      case `${chatId}/setting/uploadUser`:
        await MsgCommand.uploadUser(global,chatId)
        break
      case `${chatId}/setting/downloadUser`:
        await MsgCommand.downloadUser(global,chatId)
        break
      case `${chatId}/setting/ai/clearHistory`:
        await MsgCommand.clearHistory(chatId)
        break
      case `${chatId}/setting/ai/reloadCommands`:
        await MsgCommand.reloadCommands(chatId, DEFAULT_AI_CONFIG_COMMANDS)
        break
      case `${chatId}/requestChatStream/stop`:
        MsgDispatcher.updateMessage(chatId,messageId, {
          inlineButtons:[
            [
              {
                text: "已停止输出",
                type: "unsupported"
              }
            ]
          ]
        })
        await callApiWithPdu(new StopChatStreamReq({
          chatId:parseInt(chatId),
          msgId:messageId
        }).pack())
        break
      case `${chatId}/init_system_content`:
        global = getGlobal();
        let init_system_content = MsgCommandChatGpt.getChatGptConfig(global,chatId,"init_system_content")
        const {value} = await showModalFromEvent({
          type:"singleInput",
          title:"请输入 上下文记忆",
          placeholder:"每次请求都会带入 上下文记忆",
          initVal:init_system_content
        });
        if(value){
          init_system_content = value
          MsgCommandChatGpt.changeChatGptConfig(chatId,{
            init_system_content:value
          })
          const message1 = {
            content:{
              text:{
                text:`${init_system_content?init_system_content:"未设置"}`
              }
            },
            inlineButtons:[
              [
                {
                  text:"点击修改 Prompt",
                  type:"callback",
                  data:`${chatId}/init_system_content`
                }
              ]
            ]
          }
          // @ts-ignore
          MsgDispatcher.newMessage(chatId,messageId,message1)
        }

        break;
      case `${chatId}/apiKey`:
        const res = await showModalFromEvent({
          type:"singleInput",
          title:"请输入 ApiKey",
          placeholder:""
        });
        let api_key = res.value
        if(api_key){
          global = getGlobal();
          const user = selectUser(global,chatId);
          global = updateUser(global,chatId,{
            ...user,
            fullInfo:{
              ...user?.fullInfo,
              botInfo:{
                ...user?.fullInfo?.botInfo!,
                aiBot:{
                  ...user?.fullInfo?.botInfo?.aiBot,
                  chatGptConfig:{
                    ...user?.fullInfo?.botInfo?.aiBot?.chatGptConfig,
                    api_key
                  }
                }
              }
            }
          })
          setGlobal(global)
          if(api_key){
            api_key = "```\n"+api_key+"```";
          }
          const message2 = {
            content:{
              text:{
                text:`当前 /apiKey:\n ${api_key? api_key:"未设置"}`
              }
            },
            inlineButtons:[
              [
                {
                  text:"点击修改 apiKey",
                  type:"callback",
                  data:`${chatId}/apiKey`
                }
              ]
            ]
          }
          // @ts-ignore
          MsgDispatcher.newMessage(chatId,messageId,message2)
        }

        break;
      case `${chatId}/enableAi/0`:
      case `${chatId}/enableAi/1`:
        const isEnable = data === `${chatId}/enableAi/1`;
        global = getGlobal();
        const user = selectUser(global,chatId);
        global = updateUser(global,chatId,{
          ...user,
          fullInfo:{
            ...user?.fullInfo,
            botInfo:{
              ...user?.fullInfo?.botInfo!,
              aiBot:{
                ...user?.fullInfo?.botInfo?.aiBot,
                enableAi:isEnable
              }
            }
          }
        })
        setGlobal(global)
        MsgDispatcher.updateMessage(chatId,messageId,{
          content:{
            text:{
              text:`当前状态:【${isEnable ? "开启" : "关闭"}】，修改请点击下面按钮:`
            }
          },
          inlineButtons:[
            [
              {
                text:isEnable ? "关闭" : "开启",
                type:"callback",
                data:`${chatId}/enableAi/${isEnable ? "0":"1"}`
              }
            ]
          ]
        })
        break
    }
  }
}
