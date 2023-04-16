import MsgDispatcher from "./MsgDispatcher";
import {currentTs, isPositiveInteger} from "../share/utils/utils";
import {ApiBotInfo, ApiKeyboardButtons, ApiMessage} from "../../api/types";
import {AiReplyHistoryRole, GlobalState} from "../../global/types";
import {getGlobal, setGlobal} from "../../global";
import {selectChatMessage, selectUser} from "../../global/selectors";
import {updateUser} from "../../global/reducers";
import {
  AI_START_TIPS, ALL_CHAT_GPT_MODELS,
  ChatModelConfig,
  DEFAULT_BOT_COMMANDS,
  DEFAULT_CHATGPT_AI_COMMANDS,
  STOP_HANDLE_MESSAGE
} from "../setting";
import {callApiWithPdu} from "./utils";
import {StopChatStreamReq} from "../../lib/ptp/protobuf/PTPOther";
import Account from "../share/Account";
import MsgCommand from "./MsgCommand";
import {showModalFromEvent} from "../share/utils/modal";
import {PbAiBot_Type, PbChatGpBotConfig_Type, PbChatGptModelConfig_Type} from "../../lib/ptp/protobuf/PTPCommon/types";
import {AiHistoryType} from "./MsgChatGpWorker";

export default class MsgCommandChatGpt{
  private chatId: string;
  private botInfo: ApiBotInfo;
  constructor(chatId:string,botInfo:ApiBotInfo) {
    this.chatId = chatId
    this.botInfo = botInfo;
  }
  static getAiHistoryList(chatId:string){
    const global = getGlobal();
    const {aiReplyHistory} = global
    const historyList = aiReplyHistory[chatId] || []
    if (historyList.length>0){
      // @ts-ignore
      const max_history_length:number = MsgCommandChatGpt.getChatGptConfig(global,chatId,"max_history_length")
      let rows:AiHistoryType[] = []

      if(max_history_length !== undefined){
        if(max_history_length){
          for (let i = 0; i < historyList.length; i++) {
            const {msgId,role} = historyList[i]
            const message = selectChatMessage(global,chatId,msgId)
            if(message && message?.content.text){
              rows.push({
                role:role === AiReplyHistoryRole.USER ? "user" : "assistant",
                content:message!.content.text!.text,
                date: new Date(message.date*1000).toLocaleString(),
              })
            }
          }
          if(rows.length > max_history_length){
            rows = rows.slice(Math.max(0,historyList.length - max_history_length))
          }
        }else {
          rows = []
        }
      }
      return rows;
    }else{
      return []
    }
  }
  static getInlineButtons(chatId:string):ApiKeyboardButtons{
    const isEnableSync = Account.getCurrentAccount()?.getSession();
    const global = getGlobal();
    const isEnableAi = MsgCommandChatGpt.getAiBotConfig(global,chatId,'enableAi')
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
      [
        ...MsgCommand.buildInlineCallbackButton(chatId,`setting/ai/enable/${ isEnableAi ? 0 : 1 }`,isEnableAi ? "关闭ai" : "启用ai"),
      ],
      [
        ...MsgCommand.buildInlineCallbackButton(chatId,'setting/ai/toggleClearHistory',disableClearHistory ? "允许清除历史记录":"关闭清除历史记录"),
        ...(disableClearHistory ? [] : MsgCommand.buildInlineCallbackButton(chatId,'setting/ai/clearHistory',"清除历史记录")),
      ],

      [
        ...MsgCommand.buildInlineCallbackButton(chatId,'setting/ai/customApi',"自定义机器人api"),
      ],
    ]:[
      [
        ...MsgCommand.buildInlineCallbackButton(chatId,`setting/ai/enable/${ isEnableAi ? 0 : 1 }`,isEnableAi ? "关闭ai" : "启用ai"),
      ],
      [
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

    await MsgDispatcher.updateMessage(chatId,messageId,{
      inlineButtons:MsgCommandChatGpt.getInlineButtons(chatId)
    })
  }
  async setting(){
    const {chatId} = this;
    await MsgCommandChatGpt.reloadCommands(chatId)
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
      inlineButtons:MsgCommandChatGpt.getInlineButtons(chatId),
    })
  }
  async start(){
    const messageId = await MsgDispatcher.genMsgId();
    const {chatId} = this
    await MsgCommandChatGpt.reloadCommands(chatId);
    const enableAi = MsgCommandChatGpt.getAiBotConfig(getGlobal(),chatId,'enableAi')
    const text = enableAi ? AI_START_TIPS+`\n`+DEFAULT_CHATGPT_AI_COMMANDS.map(cmd=>{
      return `/${cmd.command} ${cmd.description}`
    }).join("\n")+"\n":AI_START_TIPS;
    const message = {
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
            text:"点击修改 初始化 Prompt",
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
  static getChatGptConfig(global:GlobalState,chatId:string,key:'api_key'|'max_history_length'|'init_system_content'|'modelConfig'){
    // @ts-ignore
    const aiBotConfig:PbChatGptBotConfig_Type = MsgCommandChatGpt.getAiBotConfig(global,chatId,"chatGptConfig")
    if(aiBotConfig && aiBotConfig[key]){
      return aiBotConfig[key]
    }else{
      if(key === "modelConfig"){
        return ChatModelConfig
      }
      return ""
    }
  }

  static getChatGptModelConfig(global:GlobalState,chatId:string,key:'model'|'temperature'|'max_tokens'|'presence_penalty'){
    // @ts-ignore
    const modelConfig:PbChatGptModelConfig_Type = MsgCommandChatGpt.getChatGptConfig(global,chatId,"modelConfig")
    if(modelConfig && undefined !== modelConfig[key]){
      return modelConfig[key]
    }else{
      return ChatModelConfig[key]
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

  static changeChatGptModelConfig(botId:string,chatGptModelConfig:Partial<PbChatGptModelConfig_Type>){
    let global = getGlobal();
    const user = selectUser(global,botId);
    const modelConfig = MsgCommandChatGpt.getChatGptConfig(global,botId,"modelConfig")
    MsgCommandChatGpt.changeChatGptConfig(botId,{
      modelConfig:{
        ...modelConfig,
        ...chatGptModelConfig
      }
    })
  }
  async maxHistoryLength(){
    const {chatId} = this
    let max_history_length = MsgCommandChatGpt.getChatGptConfig(getGlobal(),chatId,"max_history_length")
    const {value} = await showModalFromEvent({
      initVal:(max_history_length||0).toString(),
      title:"请输入携带历史消息数",
      placeholder:"每次提问携带历史消息数,当为 0 时不携带,须为偶数"
    })
    if(value && value!== max_history_length){
      max_history_length = isPositiveInteger(value) ? parseInt(value) : 0;
      MsgCommandChatGpt.changeChatGptConfig(chatId,{max_history_length})
      return await MsgDispatcher.newTextMessage(chatId,undefined,'修改成功')
    }
    return STOP_HANDLE_MESSAGE
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
    return STOP_HANDLE_MESSAGE
  }
  async reset(){
    const global = getGlobal();
    const {chatId} = this
    setGlobal({
      ...global,
      aiReplyHistory:{
        ...global.aiReplyHistory,
        [chatId]:[]
      }
    })
    await MsgDispatcher.newTextMessage(chatId,undefined,"重置成功")
    return STOP_HANDLE_MESSAGE
  }
  async enableAi(){
    const messageId = await MsgDispatcher.genMsgId();
    const {chatId} = this
    const isEnable = MsgCommandChatGpt.getAiBotConfig(getGlobal(),chatId,"enableAi")
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
  static async customApi(chatId:string,messageId:number){
    await MsgDispatcher.newTextMessage(chatId,undefined,"自定义api",[
      [
        ...MsgCommand.buildInlineCallbackButton(chatId,'setting/ai/setApi',"设置api"),
      ],
      [
        ...MsgCommand.buildInlineBackButton(chatId,messageId,'setting/ai/back',"< 返回"),
      ]
    ])
  }
  static async setApi(chatId:string,messageId:number){
    // @ts-ignore
    let botApi:string | undefined = MsgCommandChatGpt.getAiBotConfig(getGlobal(),chatId,'botApi')
    const {value} = await showModalFromEvent({
      title:"请输入api地址",
      initVal:botApi || ""
    })
    botApi = value;
    MsgCommandChatGpt.changeAiBotConfig(getGlobal(),chatId,{
      botApi:value
    })
    MsgDispatcher.updateMessage(chatId,messageId,{
      content:{
        text:{
          text:botApi ? `地址: ${botApi}` : "请输入api地址"
        }
      }
    })
  }
  static getAiModelInlineButtons(chatId:string){

    const modelConfig = MsgCommandChatGpt.getChatGptConfig(getGlobal(),chatId,"modelConfig")
    const models =   ALL_CHAT_GPT_MODELS.filter(({name})=>name !== modelConfig.model).map(({name})=>{
      return MsgCommand.buildInlineCallbackButton(chatId,"model/switch/"+name,"# "+name)
    })
    return [
      [...MsgCommand.buildInlineCallbackButton(chatId,"model/property/temperature","> 随机性 (temperature): "+modelConfig.temperature)],
      [...MsgCommand.buildInlineCallbackButton(chatId,"model/property/max_tokens","> 单次回复限制 (max_tokens): "+modelConfig.max_tokens)],
      [...MsgCommand.buildInlineCallbackButton(chatId,"model/property/presence_penalty","> 话题新鲜度 (presence_penalty): "+modelConfig.presence_penalty)],
      [...MsgCommand.buildInlineButton(chatId,"切换其他模型","unsupported")],
      ...models
    ]
  }
  async aiModel(){
    const messageId = await MsgDispatcher.genMsgId();
    const {chatId} = this
    const modelConfig = MsgCommandChatGpt.getChatGptConfig(getGlobal(),chatId,"modelConfig")
    const inlineButtons:ApiKeyboardButtons = MsgCommandChatGpt.getAiModelInlineButtons(chatId);
    const message:ApiMessage = {
      chatId,
      id:messageId,
      senderId:chatId,
      isOutgoing:false,
      date:currentTs(),
      content:{
        text:{
          text:`当前模型:【${modelConfig.model}】`
        }
      },
      inlineButtons
    }
    MsgDispatcher.newMessage(chatId,messageId,message)
    return message
  }
  static async handleChangeModelConfig(chatId:string,messageId:number,key:'model'|'temperature'|'max_tokens'|'presence_penalty'){
    const val:any = MsgCommandChatGpt.getChatGptModelConfig(getGlobal(),chatId,key)
    let title = "";
    let placeholder = "";
    let step = 1;
    let max = 2;
    let min = 0;
    switch (key){
      case "temperature":
        step = 0.1;
        title = "随机性 (temperature)";
        placeholder = "值越大，回复越随机";
        break
      case "max_tokens":
        step = 1;
        max = 4096
        min = 100;
        title = "单次回复限制 (max_tokens)";
        placeholder = "单次交互所用的最大 Token 数";
        break
      case "presence_penalty":
        step = 0.5;
        max = 2
        min = -2;
        title = "话题新鲜度 (presence_penalty)";
        placeholder = "值越大，越有可能扩展到新话题";
        break
    }
    const initVal = val === 0 ? "0" : val
    const {value} = await showModalFromEvent({
      title,
      placeholder,
      type:'singleInput',
      inputType:"number",
      initVal,
      step,
      min,
      max
    })

    if(value !== val){
      MsgCommandChatGpt.changeChatGptModelConfig(chatId,{
        [key]:Number(value)
      })
    }
    const inlineButtons:ApiKeyboardButtons = MsgCommandChatGpt.getAiModelInlineButtons(chatId)
    MsgDispatcher.updateMessage(chatId,messageId,{
      inlineButtons
    })

  }
  static async switch(global:GlobalState,chatId:string,messageId:number,data:string){
    const model = data.replace(`${chatId}/model/switch/`,"")
    MsgCommandChatGpt.changeChatGptModelConfig(chatId,{
      model
    })
    const inlineButtons:ApiKeyboardButtons = MsgCommandChatGpt.getAiModelInlineButtons(chatId)
    MsgDispatcher.updateMessage(chatId,messageId,{
      inlineButtons
    })
  }
  static async answerCallbackButton(global:GlobalState,chatId:string,messageId:number,data:string){
    if(data.startsWith(`${chatId}/setting/ai/back`)){
      await MsgCommand.back(global,chatId,messageId,data,"setting/ai/back")
      return
    }
    if(data.startsWith(`${chatId}/model/switch`)){
      await MsgCommandChatGpt.switch(global,chatId,messageId,data)
      return
    }
    switch (data){
      case `${chatId}/model/property/temperature`:
        await MsgCommandChatGpt.handleChangeModelConfig(chatId,messageId,"temperature")
        return
      case `${chatId}/model/property/max_tokens`:
        await MsgCommandChatGpt.handleChangeModelConfig(chatId,messageId,"max_tokens")
        return
      case `${chatId}/model/property/presence_penalty`:
        await MsgCommandChatGpt.handleChangeModelConfig(chatId,messageId,"presence_penalty")
        return
      case `${chatId}/setting/ai/setApi`:
        await MsgCommandChatGpt.setApi(chatId,messageId)
        return
      case `${chatId}/setting/ai/customApi`:
        await MsgCommandChatGpt.customApi(chatId,messageId)
        return
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
        await MsgCommandChatGpt.reloadCommands(chatId)
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
                  text:"点击修改 初始化 Prompt",
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
      case `${chatId}/setting/ai/enable/1`:
      case `${chatId}/setting/ai/enable/0`:
        const isEnable = data === `${chatId}/setting/ai/enable/1`;
        MsgCommandChatGpt.changeAiBotConfig(global,chatId,{
          enableAi:isEnable
        })
        await MsgCommandChatGpt.reloadCommands(chatId)
        MsgDispatcher.updateMessage(chatId,messageId,{
          inlineButtons:MsgCommandChatGpt.getInlineButtons(chatId,)
        })
        break
    }
  }

  private static async reloadCommands(chatId:string) {
    const isEnable = MsgCommandChatGpt.getAiBotConfig(getGlobal(),chatId,"enableAi");
    await MsgCommand.reloadCommands(chatId,isEnable ? [...DEFAULT_BOT_COMMANDS,...DEFAULT_CHATGPT_AI_COMMANDS]:DEFAULT_BOT_COMMANDS)
  }
}
