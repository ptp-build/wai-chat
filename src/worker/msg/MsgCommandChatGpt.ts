import MsgDispatcher from "./MsgDispatcher";
import {downloadFromLink, isPositiveInteger, showBodyLoading} from "../share/utils/utils";
import {ApiKeyboardButtons} from "../../api/types";
import {GlobalState} from "../../global/types";
import {getGlobal, setGlobal} from "../../global";
import {selectChatMessage, selectUser} from "../../global/selectors";
import {updateUser} from "../../global/reducers";
import {
  ALL_CHAT_GPT_MODELS,
  ChatModelConfig,
  DEFAULT_BOT_COMMANDS,
  DEFAULT_CHATGPT_AI_COMMANDS,
  STOP_HANDLE_MESSAGE,
  WaterMark
} from "../setting";
import {callApiWithPdu} from "./utils";
import {StopChatStreamReq} from "../../lib/ptp/protobuf/PTPOther";
import MsgCommand from "./MsgCommand";
import {showModalFromEvent} from "../share/utils/modal";
import {PbAiBot_Type, PbChatGpBotConfig_Type, PbChatGptModelConfig_Type} from "../../lib/ptp/protobuf/PTPCommon/types";
import {UpdateCmdReq, UpdateCmdRes} from "../../lib/ptp/protobuf/PTPMsg";
import {requestUsage} from "../../lib/ptp/functions/requests";
import {CLOUD_MESSAGE_API, DEBUG} from "../../config";
import ChatMsg from "./ChatMsg";
import {generateImageFromDiv} from "../share/utils/canvas";

export default class MsgCommandChatGpt{
  private chatId: string;
  private chatMsg: ChatMsg;
  constructor(chatId:string) {
    this.chatId = chatId
    this.chatMsg = new ChatMsg(chatId)
  }

  getInlineButtons():ApiKeyboardButtons{
    const chatId = this.chatId
    const isEnableAi = this.getAiBotConfig('enableAi')
    const disableClearHistory = this.getAiBotConfig('disableClearHistory')
    const res = [
      [
        ...MsgCommand.buildInlineCallbackButton(
          chatId,
          `setting/ai/enable/${ isEnableAi ? 0 : 1 }`,
          isEnableAi ? "关闭 Ai" : "启用 Ai"
        ),
      ],
      [
        ...MsgCommand.buildInlineCallbackButton(chatId,'setting/ai/toggleClearHistory',disableClearHistory ? "允许清除历史记录":"关闭清除历史记录"),
        ...(disableClearHistory ? [] : MsgCommand.buildInlineCallbackButton(chatId,'setting/ai/clearHistory',"清除历史记录")),
      ],
      [
        ...MsgCommand.buildInlineCallbackButton(chatId,'setting/export/image',"导出 Image"),
        ...MsgCommand.buildInlineCallbackButton(chatId,'setting/export/markdown',"导出 Markdown"),
      ],
    ]
    if(CLOUD_MESSAGE_API){
      res.push(
        [
          ...MsgCommand.buildInlineCallbackButton(chatId,'setting/uploadUser',"上传机器人"),
          ...MsgCommand.buildInlineCallbackButton(chatId,'setting/downloadUser',"下载机器人"),
        ],
      )
    }
    res.push(
      [
          ...MsgCommand.buildInlineCallbackButton(chatId,'setting/ai/customApi',"自定义机器人Api"),
      ],
    )
    res.push(
      [
        ...MsgCommand.buildInlineCallbackButton(chatId,'setting/signGen',"生成签名"),
      ],
    )
    return res
  }

  async export(messageId:number,type:string){
    const global = getGlobal();
    const {chatGptAskHistory} = global
    const messageIds = []
    Object.keys(chatGptAskHistory[this.chatId]).forEach(id=>{
      const userMsgId = chatGptAskHistory[this.chatId][id]
      messageIds.push(userMsgId)
      messageIds.push(parseInt(id))
    })

    if(messageIds.length == 0){
      return MsgDispatcher.showNotification("not found ai message")
    }
    showBodyLoading(true)
    const file_name = "chat_"+this.chatId
    switch (type){
      case "pdf":
      case "image":
        const url = await generateImageFromDiv(
          messageIds.map(id=>`message${id}`),
          20,
          "#99BA92",
          WaterMark,
          type
        );
        if(type === 'image'){
          downloadFromLink(file_name+".png",url);
        }else{
          downloadFromLink(file_name+".pdf",url);
        }
        break
      case "markdown":
        const messages = messageIds.map((id,i)=>{
          const message = selectChatMessage(global,this.chatId,id)
          if( i%2 === 0){
            return `Q:\n-----------\n${message?.content.text?.text}\n`
          }else{
            return `A:\n-----------\n${message?.content.text?.text}\n\n`
          }
        }).join("\n")
        const blob = new Blob([messages], { type: 'text/plain' });
        downloadFromLink(file_name+".md",URL.createObjectURL(blob));
        break
    }
    showBodyLoading(false)
    return STOP_HANDLE_MESSAGE
  }
  async toggleClearHistory(messageId:number){
    const disableClearHistory = this.getAiBotConfig('disableClearHistory')
    await this.changeAiBotConfig({
      "disableClearHistory":!disableClearHistory
    })
    await this.chatMsg.update(messageId,{
      inlineButtons:this.getInlineButtons()
    })
  }
  async setting(){
    await this.reloadCommands()
    const text = `设置面板`
    return this.chatMsg.setText(text).setInlineButtons(this.getInlineButtons()).reply();
  }
  async start(){
    const {chatId} = this
    if(DEBUG){
      const global = getGlobal();
      console.log({user:global.users.byId[chatId],messages:global.messages.byChatId[chatId]})
    }
    await this.reloadCommands();
    const commands = this.getCommands();
    const text = `你可以通过发送以下命令来控制我：\n\n` + commands.map(cmd=>{
      return `/${cmd.command} ${cmd.description}`
    }).join("\n") + "\n";
    return this.chatMsg.setText(text).reply();
  }
  async systemPrompt(){
    const {chatId} = this
    const init_system_content = this.getChatGptConfig("init_system_content")

    return this.chatMsg.setText("```\n"+init_system_content+"```").setInlineButtons([
      [
        {
          text:"点击修改 系统 Prompt",
          type:"callback",
          data:`${chatId}/init_system_content`
        }
      ]
    ]).reply();
  }

  getAiBotConfig(key:'enableAi'|'botApi'|'commandsFromApi'|'chatGptConfig'|'disableClearHistory'){
    const global = getGlobal();
    const user = selectUser(global,this.chatId);
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
  getChatGptConfig(key:'api_key'|'max_history_length'|'init_system_content'|'modelConfig'){
    const aiBotConfig = this.getAiBotConfig("chatGptConfig") as PbChatGpBotConfig_Type
    if(aiBotConfig && aiBotConfig[key] !== undefined){
      return aiBotConfig[key]
    }else{
      if(key === "modelConfig"){
        return ChatModelConfig
      }

      if(key === "max_history_length"){
        return -1
      }
      return ""
    }
  }

  getChatGptModelConfig(key:'model'|'temperature'|'max_tokens'|'presence_penalty'){
    const modelConfig = this.getChatGptConfig("modelConfig") as PbChatGptModelConfig_Type
    if(modelConfig && undefined !== modelConfig[key]){
      return modelConfig[key]
    }else{
      return ChatModelConfig[key]
    }
  }

  changeAiBotConfig(aiConfig:Partial<PbAiBot_Type>){
    let global = getGlobal();
    const user = selectUser(global,this.chatId);
    global = updateUser(global,this.chatId,{
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
  changeChatGptConfig(chatGptConfig:Partial<PbChatGpBotConfig_Type>){
    let global = getGlobal();
    const user = selectUser(global,this.chatId);

    this.changeAiBotConfig({
      ...user?.fullInfo?.botInfo?.aiBot,
      chatGptConfig:{
        ...user?.fullInfo?.botInfo?.aiBot?.chatGptConfig,
        ...chatGptConfig
      }
    })
  }

  changeChatGptModelConfig(chatGptModelConfig:Partial<PbChatGptModelConfig_Type>){
    const modelConfig = this.getChatGptConfig("modelConfig") as PbChatGptModelConfig_Type
    this.changeChatGptConfig({
      modelConfig:{
        ...modelConfig,
        ...chatGptModelConfig
      }
    })
  }
  async maxHistoryLength(){
    let max_history_length = this.getChatGptConfig("max_history_length")
    const {value} = await showModalFromEvent({
      initVal:(max_history_length||0).toString(),
      title:"请输入携带历史消息数",
      inputType:"number",
      placeholder:"每次提问携带历史消息数,当为 0 时不携带,须为偶数"
    })
    if(value && value!== max_history_length){
      max_history_length = isPositiveInteger(value) ? parseInt(value) : 0;
      this.changeChatGptConfig({max_history_length})
      return this.chatMsg.setText("修改成功").reply()
    }
    return STOP_HANDLE_MESSAGE
  }

  async usage(){
    const api_key = this.getChatGptConfig("api_key")
    const msg = await this.chatMsg.setThinking().reply();
    try {
      // @ts-ignore
      const {text} = await requestUsage(api_key)
      await this.chatMsg.updateText(msg.id,text)
    }catch (e){
      console.error(e)
      await this.chatMsg.updateText(msg.id,"查询失败")
    }
    return STOP_HANDLE_MESSAGE
  }
  async apiKey(){
    const {chatId} = this
    const api_key = this.getChatGptConfig("api_key") as string
    const {value} = await showModalFromEvent({
      initVal:api_key,
      title:"请输入apiKey",
      placeholder:"你可以使用自己的 api_key"
    })
    if(value!== api_key){
      localStorage.setItem("cg-key",value || "")
      this.changeChatGptConfig({api_key:value})
      MsgDispatcher.showNotification("修改成功")
    }
    return STOP_HANDLE_MESSAGE
  }
  async reset(){
    const global = getGlobal();
    const {chatId} = this
    setGlobal({
      ...global,
      chatGptAskHistory:{
        ...global.chatGptAskHistory,
        [chatId]:{}
      }
    })
    await this.chatMsg.setText("重置成功").reply()
    return STOP_HANDLE_MESSAGE
  }
  async enableAi(){
    const isEnable = this.getAiBotConfig("enableAi")
    return this.chatMsg.setText(`当前AI状态:【${isEnable ? "开启" : "关闭"}】，修改请点击下面按钮:`).setInlineButtons([
      [
        {
          text:isEnable ? "关闭" : "开启",
          type:"callback",
          data:`${this.chatId}/enableAi/${isEnable ? "0":"1"}`
        }
      ]
    ]).reply()
  }

  getCustomApiInlineButtons(messageId:number){
    const botApi = this.getAiBotConfig('botApi')
    const chatId = this.chatId;
    return [
      [
        ...MsgCommand.buildInlineCallbackButton(chatId,'setting/ai/setApi',botApi ? "修改Api": "设置Api"),
        ...(botApi ? MsgCommand.buildInlineCallbackButton(chatId,'setting/ai/disableApi',"禁用Api"):[]),
        ...(botApi ? MsgCommand.buildInlineCallbackButton(chatId,'setting/ai/updateCmd',"更新命令"):[]),
      ],
      [
        ...MsgCommand.buildInlineBackButton(chatId,messageId,'setting/ai/back',"< 返回"),
      ]
    ]
  }
  async customApi(messageId:number){
    await this.chatMsg.update(messageId,{
      content:{
        text:{
          text:"通过自定义api，可以使用单独的机器人Api"
        }
      },
      inlineButtons:this.getCustomApiInlineButtons(messageId)
    })
  }

  async updateCmd(messageId:number){
    const chatId = this.chatId;
    const botApi = this.getAiBotConfig('botApi') as string
    const res = await callApiWithPdu(new UpdateCmdReq({
      botApi,
      chatId,
    }).pack())
    if(res){
      const {commands} = UpdateCmdRes.parseMsg(res.pdu)
      this.changeAiBotConfig({
        commandsFromApi:commands?.map(cmd=>{
          return{
            ...cmd,
            botId:chatId
          }
        })
      })
      await this.reloadCommands()
      await this.chatMsg.setText("更新成功").reply()
    }else{
      await this.chatMsg.setText("更新失败").reply()
    }
  }
  async disableApi(messageId:number){

    this.changeAiBotConfig({
      botApi:undefined
    })
    const inlineButtons = this.getCustomApiInlineButtons(messageId)
    const message = selectChatMessage(getGlobal(),this.chatId,messageId)
    this.chatMsg.update(messageId,{
      content: {
        text: {
          text: "请输入api地址"
        }
      },
      inlineButtons: [
        ...inlineButtons.slice(0,inlineButtons.length-1),
        ...message!.inlineButtons!.slice(inlineButtons.length-1)
      ]
    })
  }
  async setApi(messageId:number){
    let botApi = this.getAiBotConfig('botApi') as string | undefined
    const {value} = await showModalFromEvent({
      title:"请输入api地址",
      initVal:botApi || ""
    })
    botApi = value;
    this.changeAiBotConfig({
      botApi:value
    })
    const inlineButtons = this.getCustomApiInlineButtons(messageId)
    const message = selectChatMessage(getGlobal(),this.chatId,messageId)
    this.chatMsg.update(messageId,{
      content: {
        text: {
          text:botApi ? `地址: ${botApi}` : "请输入api地址"
        }
      },
      inlineButtons: [
        ...inlineButtons.slice(0,inlineButtons.length-1),
        ...message!.inlineButtons!.slice(inlineButtons.length-1)
      ]
    })
  }
  getAiModelInlineButtons(){
    const chatId = this.chatId;
    const modelConfig = this.getChatGptConfig("modelConfig") as PbChatGptModelConfig_Type
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
    const modelConfig = this.getChatGptConfig("modelConfig") as PbChatGptModelConfig_Type
    const inlineButtons:ApiKeyboardButtons = this.getAiModelInlineButtons();
    return this.chatMsg.setText(`当前模型:【${modelConfig.model}】`).setInlineButtons(inlineButtons).reply()
  }
  async handleChangeModelConfig(messageId:number,key:'model'|'temperature'|'max_tokens'|'presence_penalty'){
    const val:any = this.getChatGptModelConfig(key)
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
      this.changeChatGptModelConfig({
        [key]:Number(value)
      })
    }
    const inlineButtons:ApiKeyboardButtons = this.getAiModelInlineButtons()
    this.chatMsg.update(messageId,{
      inlineButtons
    })

  }
  async switchModel(messageId:number,data:string){
    const chatId = this.chatId;
    const model = data.replace(`${chatId}/model/switch/`,"")
    this.changeChatGptModelConfig({
      model
    })
    const inlineButtons:ApiKeyboardButtons = this.getAiModelInlineButtons()
    await this.chatMsg.setText(`当前模型:【${model}】`).setInlineButtons(inlineButtons).reply()
  }
  async answerCallbackButton(global:GlobalState,messageId:number,data:string){
    const chatId = this.chatId;
    if(data.startsWith(`${chatId}/setting/ai/back`)){
      await new MsgCommand(chatId).back(global,messageId,data,"setting/ai/back")
      return
    }
    if(data.startsWith(`${chatId}/model/switch`)){
      await this.switchModel(messageId,data)
      return
    }
    switch (data){
      case `${chatId}/model/property/temperature`:
        await this.handleChangeModelConfig(messageId,"temperature")
        return
      case `${chatId}/model/property/max_tokens`:
        await this.handleChangeModelConfig(messageId,"max_tokens")
        return
      case `${chatId}/model/property/presence_penalty`:
        await this.handleChangeModelConfig(messageId,"presence_penalty")
        return
      case `${chatId}/setting/ai/disableApi`:
        await this.disableApi(messageId)
        return
      case `${chatId}/setting/ai/setApi`:
        await this.setApi(messageId)
        return
      case `${chatId}/setting/ai/updateCmd`:
        await this.updateCmd(messageId)
        return
      case `${chatId}/setting/ai/customApi`:
        await this.customApi(messageId)
        return
      case `${chatId}/setting/ai/toggleClearHistory`:
        await this.toggleClearHistory(messageId)
        return
      case `${chatId}/setting/export/markdown`:
      case `${chatId}/setting/export/image`:
        await this.export(messageId,data.replace(`${chatId}/setting/export/`,""))
        return
      case `${chatId}/setting/uploadUser`:
        await new MsgCommand(chatId).uploadUser(global)
        break
      case `${chatId}/setting/downloadUser`:
        await new MsgCommand(chatId).downloadUser(global)
        break
      case `${chatId}/setting/ai/clearHistory`:
        await new MsgCommand(chatId).clearHistory()
        break
      case `${chatId}/setting/ai/reloadCommands`:
        await this.reloadCommands()
        break
      case `${chatId}/requestChatStream/stop`:
        this.chatMsg.update(messageId,{
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
        const e = document.querySelector("#message"+messageId+" pre.text-entity-pre");
        if(e){
          const btn = document.querySelector("#message"+messageId+" .InlineButtons .inline-button-text");
          // @ts-ignore
          if(e.contentEditable === "true"){
            // @ts-ignore
            btn.innerText = "点击修改"
            // @ts-ignore
            e.contentEditable = false
            // @ts-ignore
            e.blur();
          }else{
            // @ts-ignore
            btn.innerText = "保存修改"
            // @ts-ignore
            e.contentEditable = true
            // @ts-ignore
            e.focus();
            e.addEventListener('focus', ()=>{
              // @ts-ignore
              btn.innerText = "保存修改"
            });
            e.addEventListener('blur', ()=>{
              // @ts-ignore
              e.contentEditable = false
              // @ts-ignore
              const init_system_content = e.innerText
              this.changeChatGptConfig({
                init_system_content
              })
            });
          }

        }
        break;
      case `${chatId}/apiKey`:
        const res = await showModalFromEvent({
          type:"singleInput",
          title:"请输入 ApiKey",
          placeholder:""
        });
        let api_key = this.getChatGptConfig('api_key')
        if(api_key !== res.value) {
          api_key = res.value;
          this.changeChatGptConfig({
            api_key
          })
        }
        break;
      case `${chatId}/setting/ai/enable/1`:
      case `${chatId}/setting/ai/enable/0`:
        const isEnable = data === `${chatId}/setting/ai/enable/1`;
        this.changeAiBotConfig({
          enableAi:isEnable
        })
        await this.reloadCommands()
        await this.chatMsg.update(messageId,{
          inlineButtons:this.getInlineButtons()
        })
        break
    }
  }
  getCommands(){
    const commandsFromApi = this.getAiBotConfig('commandsFromApi')
    const botApi = this.getAiBotConfig('botApi')
    const isEnable = this.getAiBotConfig("enableAi");
    let commands = [...DEFAULT_BOT_COMMANDS]

    if(botApi){
      if(commandsFromApi){
        // @ts-ignore
        commands = [...commands,...commandsFromApi!]
      }
    }else{
      if(isEnable){
        commands = [...commands,...DEFAULT_CHATGPT_AI_COMMANDS]
      }
    }
    return commands
  }
  private async reloadCommands() {
    await new MsgCommand(this.chatId).reloadCommands(this.getCommands())
  }
}
