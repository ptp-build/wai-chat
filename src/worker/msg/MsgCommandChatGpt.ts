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
  SERVER_BOT_USER_ID_START,
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
  private outGoingMsgId: number | undefined;
  constructor(chatId:string) {
    this.chatId = chatId
    this.chatMsg = new ChatMsg(chatId)
  }
  setOutGoingMsgId(outGoingMsgId?:number){
    this.outGoingMsgId = outGoingMsgId
  }
  isMyBot(){
    const global = getGlobal();
    const {userStoreData} = global
    const {myBots} = userStoreData || {}
    const i = parseInt(this.chatId)
    if(i < parseInt(SERVER_BOT_USER_ID_START)){
      return true;
    }
    return myBots && myBots.includes(this.chatId)
  }
  getInlineButtons(outGoingMsgId:number):ApiKeyboardButtons{
    const chatId = this.chatId
    const isMyBot = this.isMyBot()
    const isEnableAi = this.getAiBotConfig('enableAi')
    const disableClearHistory = this.getAiBotConfig('disableClearHistory')
    const res = [
        isMyBot ? [
        ...MsgCommand.buildInlineCallbackButton(
          chatId,
          `${outGoingMsgId}/setting/ai/enable/${ isEnableAi ? 0 : 1 }`,
          isEnableAi ? "关闭 Ai" : "启用 Ai"
        ),
      ]:[],
      [
        ...MsgCommand.buildInlineCallbackButton(chatId,outGoingMsgId+'/setting/ai/toggleClearHistory',disableClearHistory ? "允许清除历史记录":"关闭清除历史记录"),
        ...(disableClearHistory ? [] : MsgCommand.buildInlineCallbackButton(chatId,'setting/ai/clearHistory',"清除历史记录")),
      ],
      [
        ...MsgCommand.buildInlineCallbackButton(chatId,'setting/export/image',"导出 Image"),
        ...MsgCommand.buildInlineCallbackButton(chatId,'setting/export/markdown',"导出 Markdown"),
      ],
    ]
    if(CLOUD_MESSAGE_API){
      if(isMyBot){
        const t = MsgCommand.buildInlineOpenProfileBtn(chatId,"修改机器人")
        // @ts-ignore
        res.push([...t])
      }
      res.push(
        [
          ...MsgCommand.buildInlineCallbackButton(chatId,outGoingMsgId + '/setting/copyBot',"复制机器人"),
        ],
      )
      res.push(
        [
          ...(true ? MsgCommand.buildInlineCallbackButton(chatId,outGoingMsgId + '/setting/uploadUser',"上传机器人"):[]),
          ...(true ? MsgCommand.buildInlineCallbackButton(chatId,outGoingMsgId + '/setting/downloadUser',"更新机器人"):[]),
          ...(true ? MsgCommand.buildInlineCallbackButton(chatId,outGoingMsgId + '/setting/downloadMsg',"更新消息"):[]),
        ],
      )
      // res.push(
      //   [
      //     ...MsgCommand.buildInlineCallbackButton(chatId,'setting/ai/customApi',"自定义机器人Api"),
      //   ],
      // )
    }
    // res.push(
    //   [
    //     ...MsgCommand.buildInlineCallbackButton(chatId,'setting/signGen',"生成签名"),
    //   ],
    // )

    res.push([
      {
        data:`${chatId}/${outGoingMsgId ? `${outGoingMsgId}/`:""}setting/cancel`,
        text:"取消",
        type:"callback"
      },
    ])
    return res
  }

  async export(messageId:number,type:string){
    const global = getGlobal();
    const {chatGptAskHistory} = global
    const messageIds:number[] = []
    Object.keys(chatGptAskHistory[this.chatId]).forEach((id)=>{
      const msgId = parseInt(id)
      const userMsgId = chatGptAskHistory[this.chatId][msgId]
      messageIds.push(userMsgId)
      messageIds.push(msgId)
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
  async toggleClearHistory(messageId:number,outGoingMsgId:number){
    const disableClearHistory = this.getAiBotConfig('disableClearHistory')
    await this.changeAiBotConfig({
      "disableClearHistory":!disableClearHistory
    })
    await this.chatMsg.update(messageId,{
      inlineButtons:this.getInlineButtons(outGoingMsgId)
    })
  }

  async setting(outGoingMsgId:number){
    await this.reloadCommands()
    const text = `设置面板`
    return this.chatMsg.setText(text).setInlineButtons(this.getInlineButtons(outGoingMsgId)).reply();
  }

  async start(){
    const {chatId} = this
    if(DEBUG){
      const global = getGlobal();
      console.log({user:global.users.byId[chatId],messages:global.messages.byChatId[chatId]})
    }
    await this.reloadCommands();
    const botInfo = this.getBotInfo();
    const desc = botInfo?.description

    const welcome = this.getChatGptConfig("welcome") as string
    const template = this.getChatGptConfig("template") as string

    const text = `
${desc}

/help 获取帮助
`;
    await this.chatMsg.setText(text).reply();
    if(welcome){
      await new ChatMsg(this.chatId).setText(welcome).reply();
    }
    if(template){
      await new ChatMsg(this.chatId).setText("你可以复制修改发送下面的例子:\n\n```\n"+template+"```").reply();
    }

    return STOP_HANDLE_MESSAGE
  }

  async help(){
    const commands = this.getCommands();
    const help = commands.map(cmd=>{
      return `/${cmd.command} ${cmd.description}`
    }).join("\n");
    return await this.chatMsg.setText("\n你可以通过以下指令来控制我:\n\n"+help)
      .setInlineButtons([
        MsgCommand.buildInlineCallbackButton(this.chatId,`${this.outGoingMsgId}/setting/cancel`,'取消')
      ]).reply();
  }
  formatEditableText(val?:string,tips?:string){
    return "```\n"+(val||" ")+"```\n\n"+tips
  }
  async welcome(){
    const welcome = this.getChatGptConfig("welcome") as string
    return await this.chatMsg.setInlineButtons([
      MsgCommand.buildInlineCallbackButton(this.chatId,"welcome","点击修改"),
      MsgCommand.buildInlineCallbackButton(this.chatId,`${this.outGoingMsgId}/setting/cancel`,"取消"),
    ]).setText(this.formatEditableText(welcome,"欢迎语:当输入 /start 时显示")).reply();
  }

  async template(){
    const template = this.getChatGptConfig("template") as string
    return await this.chatMsg.setInlineButtons([
      MsgCommand.buildInlineCallbackButton(this.chatId,"template","点击修改"),
      MsgCommand.buildInlineCallbackButton(this.chatId,`${this.outGoingMsgId}/setting/cancel`,"取消"),
    ]).setText(this.formatEditableText(template,"用于提示用户的提问例子。" + (template ? "" : `

如:

- 主题：在线学习的好处
- 长度：500字
- 风格：信息性
    `))).reply();
  }

  async templateSubmit(){
    let templateSubmit = this.getChatGptConfig("templateSubmit") as string
    let tips = "\n\n如:"
    tips += "\n```\n请将: ${text}，翻译成：中文 , 输出格式为:{\"reply\":\"\"}```"
    tips += "\n假设你的提问是：hello , 那么您将得到输出：{\"reply\":\"你好\"}"

    if(!this.isMyBot()){
      tips += "\n\n你可以 /setting > 复制机器人 修改此选项"
      if(!templateSubmit){
        templateSubmit =  "未设置";
      }
    }
    return await this.chatMsg.setInlineButtons(this.isMyBot() ? [
      MsgCommand.buildInlineCallbackButton(this.chatId,"templateSubmit","点击修改"),
      MsgCommand.buildInlineCallbackButton(this.chatId,`${this.outGoingMsgId}/setting/cancel`,"取消"),
    ]:[
      MsgCommand.buildInlineCallbackButton(this.chatId,`${this.outGoingMsgId}/setting/cancel`,"取消"),
    ]).setText(this.formatEditableText(templateSubmit,"用于提问模版或者强制输出格式。" + tips)).reply();
  }

  async systemPrompt(){
    let init_system_content = this.getChatGptConfig("init_system_content") as string
    let tips = ""
    if(!this.isMyBot()){
      tips += "\n\n你可以 /setting > 复制机器人 修改此选项"
      if(!init_system_content){
        init_system_content = "未设置"
      }
    }
    return this.chatMsg.setText(this.formatEditableText(init_system_content,"用于提问模版,一般用于指定机器人角色,每次提问都会带入." + tips))
      .setInlineButtons(this.isMyBot() ?[
        MsgCommand.buildInlineCallbackButton(this.chatId,`init_system_content`,"点击修改"),
        MsgCommand.buildInlineCallbackButton(this.chatId,`${this.outGoingMsgId}/setting/cancel`,"取消"),
      ]:[
        MsgCommand.buildInlineCallbackButton(this.chatId,`${this.outGoingMsgId}/setting/cancel`,"取消"),
      ]).reply();
  }
  getAiBotConfig(key:'enableAi'|'botApi'|'commandsFromApi'|'chatGptConfig'|'disableClearHistory'){
    const botInfo = this.getBotInfo();
    if(
      botInfo &&
      botInfo.aiBot
    ){
      return botInfo.aiBot[key]
    }else{
      return undefined
    }
  }
  getBotInfo(){
    const global = getGlobal();
    const user = selectUser(global,this.chatId);
    if(
      user?.fullInfo &&
      user?.fullInfo.botInfo
    ){
      return user?.fullInfo.botInfo
    }else{
      return undefined
    }
  }

  getChatGptConfig(key:
    'api_key'|
    'max_history_length'|
    'init_system_content'|
    'modelConfig'|
    'welcome'|
    'template'|
    'outputText' |
    'templateSubmit'
  ){
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

  async usage(outGoingMsgId:number){
    const api_key = this.getChatGptConfig("api_key")
    const msg = await this.chatMsg.setThinking().reply();
    const inlineButtons = [
      MsgCommand.buildInlineCallbackButton(this.chatId,`${outGoingMsgId}/setting/cancel`,"取消")
    ]
    try {
      // @ts-ignore
      const {text} = await requestUsage(api_key)
      await this.chatMsg.update(msg.id,{
        content:{
          text:{
            text
          }
        },
        inlineButtons
      })
    }catch (e){
      console.error(e)
      await this.chatMsg.update(msg.id,{
        content:{
          text:{
            text:"查询失败"
          }
        },
        inlineButtons
      })
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
    await this.chatMsg.setText("重置将清除每次请求携带AI对话记录,此功能只对 /maxHistoryLength > 0  有效，但不会删除消息记录").setInlineButtons([
      MsgCommand.buildInlineCallbackButton(this.chatId,`ai/reset/confirm`,"确定"),
      MsgCommand.buildInlineCallbackButton(this.chatId,`${this.outGoingMsgId}/setting/cancel`,"取消")
    ]).reply()
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
  getAiModelInlineButtons(outGoingMsgId:number){
    const chatId = this.chatId;
    const modelConfig = this.getChatGptConfig("modelConfig") as PbChatGptModelConfig_Type
    const models = ALL_CHAT_GPT_MODELS.filter(({name})=>name !== modelConfig.model).map(({name})=>{
      return MsgCommand.buildInlineCallbackButton(chatId,outGoingMsgId+"/model/switch/"+name,"# "+name)
    })
    return [
      [...MsgCommand.buildInlineCallbackButton(chatId,outGoingMsgId+"/model/property/temperature","> 随机性 (temperature): "+modelConfig.temperature)],
      [...MsgCommand.buildInlineCallbackButton(chatId,outGoingMsgId+"/model/property/max_tokens","> 单次回复限制 (max_tokens): "+modelConfig.max_tokens)],
      [...MsgCommand.buildInlineCallbackButton(chatId,outGoingMsgId+"/model/property/presence_penalty","> 话题新鲜度 (presence_penalty): "+modelConfig.presence_penalty)],
      [...MsgCommand.buildInlineButton(chatId,"切换其他模型","unsupported")],
      ...models,
      [...MsgCommand.buildInlineCallbackButton(chatId,`${outGoingMsgId}/`+"setting/cancel","取消")],
    ]
  }
  async aiModel(outGoingMsgId:number){
    const modelConfig = this.getChatGptConfig("modelConfig") as PbChatGptModelConfig_Type
    const inlineButtons:ApiKeyboardButtons = this.getAiModelInlineButtons(outGoingMsgId);
    return this.chatMsg.setText(`当前模型:【${modelConfig.model}】`).setInlineButtons(inlineButtons).reply()
  }
  async handleChangeModelConfig(messageId:number,key:'model'|'temperature'|'max_tokens'|'presence_penalty',data:string){
    const outGoingMsgId = data.split("/")[data.split("/").length - 4]
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
    const inlineButtons:ApiKeyboardButtons = this.getAiModelInlineButtons(Number(outGoingMsgId))
    this.chatMsg.update(messageId,{
      inlineButtons
    })

  }
  async switchModel(messageId:number,data:string){
    const outGoingMsgId = data.split("/")[data.split("/").length - 4]
    const chatId = this.chatId;
    const model = data.replace(`${chatId}/${outGoingMsgId}/model/switch/`,"")
    this.changeChatGptModelConfig({
      model
    })
    const inlineButtons:ApiKeyboardButtons = this.getAiModelInlineButtons(Number(outGoingMsgId))
    await new ChatMsg(this.chatId).update(messageId,{
      inlineButtons,
      content:{
        text:{
          text:`当前模型:【${model}】`
        }
      }
    })
  }
  async answerCallbackButton(global:GlobalState,messageId:number,data:string){
    const chatId = this.chatId;
    if(data.startsWith(`${chatId}/setting/ai/back`)){
      await new MsgCommand(chatId).back(global,messageId,data,"setting/ai/back")
      return
    }
    if(data.includes(`/model/switch/`)){
      await this.switchModel(messageId,data)
      return
    }

    if(data.endsWith(`setting/ai/toggleClearHistory`)){
      const outGoingMsgId = data.split("/")[data.split("/").length - 4]
      await this.toggleClearHistory(messageId,Number(outGoingMsgId))
      return
    }
    if(data.endsWith(`model/property/temperature`)){
      await this.handleChangeModelConfig(messageId,"temperature",data)
      return
    }

    if(data.endsWith(`model/property/max_tokens`)){
      await this.handleChangeModelConfig(messageId,"max_tokens",data)
      return
    }

    if(data.endsWith(`model/property/presence_penalty`)){
      await this.handleChangeModelConfig(messageId,"presence_penalty",data)
      return
    }

    if(data.includes(`setting/ai/enable`)){
      const isEnable = data.endsWith("setting/ai/enable/1")
      const outGoingMsgId = data.split("/")[data.split("/").length - 5]

      this.changeAiBotConfig({
        enableAi:isEnable
      })
      await this.reloadCommands()
      await this.chatMsg.update(messageId,{
        inlineButtons:this.getInlineButtons(Number(outGoingMsgId))
      })
      return
    }
    if(data.endsWith(`setting/uploadUser`)){
      const outGoingMsgId = data.split('/')[data.split("/").length - 3]
      await this.chatMsg.setText("Wai遵循本地优先策略,上传机器人将会覆盖云端资料,点击 上传机器人 进入下一步")
        .setInlineButtons([
          MsgCommand.buildInlineCallbackButton(this.chatId,`/setting/uploadUser/confirm`,"上传机器人"),
          MsgCommand.buildInlineCallbackButton(this.chatId,`${outGoingMsgId}/setting/cancel`,"取消")
        ])
        .reply()
      return
    }

    if(data.endsWith(`setting/downloadUser`)){
      const outGoingMsgId = data.split('/')[data.split("/").length - 3]
      await this.chatMsg.setText("Wai遵循本地优先策略,更新机器人将会覆盖本地,点击 更新机器人 进入下一步")
        .setInlineButtons([
          MsgCommand.buildInlineCallbackButton(this.chatId,`/setting/downloadUser/confirm`,"更新机器人"),
          MsgCommand.buildInlineCallbackButton(this.chatId,`${outGoingMsgId}/setting/cancel`,"取消")
        ])
        .reply()
      return
    }

    if(data.endsWith(`setting/downloadMsg`)){
      const outGoingMsgId = data.split('/')[data.split("/").length - 3]
      await this.chatMsg.setText("Wai遵循本地优先策略,更新消息将会从云端已保存的消息覆盖到本地,点击 更新消息 进入下一步")
        .setInlineButtons([
          MsgCommand.buildInlineCallbackButton(this.chatId,`/setting/downloadMsg/confirm`,"更新消息"),
          MsgCommand.buildInlineCallbackButton(this.chatId,`${outGoingMsgId}/setting/cancel`,"取消")
        ])
        .reply()
      return
    }

    if(data.endsWith(`setting/copyBot`)){
      const outGoingMsgId = data.split('/')[data.split("/").length - 3]
      await this.chatMsg.setText("点击 复制机器人 进入下一步")
        .setInlineButtons([
          MsgCommand.buildInlineCallbackButton(this.chatId,`/setting/copyBot/confirm`,"复制机器人"),
          MsgCommand.buildInlineCallbackButton(this.chatId,`${outGoingMsgId}/setting/cancel`,"取消")
        ])
        .reply()
      return
    }


    switch (data){
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
      case `${chatId}/setting/export/markdown`:
      case `${chatId}/setting/export/image`:
        await this.export(messageId,data.replace(`${chatId}/setting/export/`,""))
        return
      case `${chatId}/setting/uploadUser/confirm`:
        await new MsgCommand(chatId).uploadUser(global,messageId)
        return
      case `${chatId}/setting/downloadUser/confirm`:
        await new MsgCommand(chatId).downloadUser(global,messageId)
        return
      case `${chatId}/setting/downloadMsg/confirm`:
        await new MsgCommand(chatId).downloadMsg(global,messageId)
        return
      case `${chatId}/setting/copyBot/confirm`:
        await new MsgCommand(chatId).copyBot(global)
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
      case `${chatId}/welcome`:
      case `${chatId}/template`:
      case `${chatId}/templateSubmit`:
      case `${chatId}/init_system_content`:
        global = getGlobal();
        const e = document.querySelector("#message"+messageId+" pre.text-entity-pre");
        if(e){
          const btn = document.querySelector("#message"+messageId+" .InlineButtons .inline-button-text");
          // @ts-ignore
          document.querySelector("#message"+messageId+" pre.text-entity-pre .code-overlay")!.style.display = "block";

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
            document.querySelector("#message"+messageId+" pre.text-entity-pre .code-overlay")!.style.display = "none";
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
              // @ts-ignore
              btn.innerText = "点击修改"
              // @ts-ignore
              e.contentEditable = false
              // @ts-ignore
              const val = e.innerText
              if(val && val.trim() === "未设置"){
                return
              }
              if(!val){
                return;
              }
              const key = data.split("/")[data.split("/").length -1]
              switch (key){
                case "welcome":
                  this.changeChatGptConfig({
                    welcome:val.trim()
                  })
                  break
                case "template":
                  this.changeChatGptConfig({
                    template:val.trim()
                  })
                  break
                case "templateSubmit":
                  this.changeChatGptConfig({
                    templateSubmit:val.trim()
                  })
                  break
                case "init_system_content":
                  this.changeChatGptConfig({
                    init_system_content:val.trim()
                  })
                  break
              }
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
    // @ts-ignore
    await new MsgCommand(this.chatId).reloadCommands(this.getCommands())
  }
}
