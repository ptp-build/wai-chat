import MsgDispatcher from "./MsgDispatcher";
import {currentTs, downloadFromLink, isPositiveInteger, showBodyLoading} from "../share/utils/utils";
import {ApiKeyboardButtons} from "../../api/types";
import {GlobalState} from "../../global/types";
import {getGlobal, setGlobal} from "../../global";
import {selectChatMessage, selectUser} from "../../global/selectors";
import {updateUser} from "../../global/reducers";
import {
  ALL_CHAT_GPT_MODELS,
  ChatModelConfig,
  DEFAULT_LANG_MNEMONIC,
  SERVER_USER_ID_START,
  STOP_HANDLE_MESSAGE,
  WaterMark
} from "../setting";
import {callApiWithPdu, sleep} from "./utils";
import {StopChatStreamReq} from "../../lib/ptp/protobuf/PTPOther";
import MsgCommand from "./MsgCommand";
import {showModalFromEvent} from "../share/utils/modal";
import {
  ERR,
  PbAiBot_Type,
  PbChatGpBotConfig_Type,
  PbChatGptModelConfig_Type,
  QrCodeType
} from "../../lib/ptp/protobuf/PTPCommon/types";
import {requestUsage} from "../../lib/ptp/functions/requests";
import {DEBUG} from "../../config";
import ChatMsg from "./ChatMsg";
import {generateImageFromDiv} from "../share/utils/canvas";
import {
  FetchBotSettingReq,
  FetchBotSettingRes,
  SaveBotSettingReq,
  ShareBotReq,
  ShareBotStopReq,
  ShareBotStopRes
} from "../../lib/ptp/protobuf/PTPUser";
import {getPasswordFromEvent} from "../share/utils/password";
import Account from "../share/Account";
import {hashSha256} from "../share/utils/helpers";
import Mnemonic, {MnemonicLangEnum} from "../../lib/ptp/wallet/Mnemonic";
import {PbQrCode} from "../../lib/ptp/protobuf/PTPCommon";
import {Pdu} from "../../lib/ptp/protobuf/BaseMsg";
import {aesDecrypt} from "../../util/passcode";

export default class MsgCommandChatGpt {
  private chatId: string;
  private chatMsg: ChatMsg;
  private outGoingMsgId: number | undefined;

  constructor(chatId: string) {
    this.chatId = chatId;
    this.chatMsg = new ChatMsg(chatId);
    this.chatMsg
  }

  setOutGoingMsgId(outGoingMsgId?: number) {
    this.outGoingMsgId = outGoingMsgId;
  }

  static isMyBot(chatId: string) {
    const global = getGlobal();
    const {userStoreData} = global;
    const {myBots} = userStoreData || {};
    return myBots && myBots.includes(chatId);
  }

  getInlineButtons(outGoingMsgId: number): ApiKeyboardButtons {
    const chatId = this.chatId;
    const isMyBot = MsgCommandChatGpt.isMyBot(this.chatId);
    const isEnableAi = this.getAiBotConfig('enableAi');
    const disableClearHistory = this.getAiBotConfig('disableClearHistory');
    const address = Account.getCurrentAccount()
      ?.getSessionAddress();
    const res = [
      [
        ...MsgCommand.buildInlineCallbackButton(chatId, "setting/doSwitchAccount", `切换账户 ( ${address?.substring(0, 4)}***${address?.substring(address?.length - 4)} )`, 'callback'),
      ],
      [
        ...MsgCommand.buildInlineCallbackButton(chatId, outGoingMsgId + '/setting/ai/toggleClearHistory', disableClearHistory ? "允许清除历史记录" : "关闭清除历史记录"),
        ...(disableClearHistory ? [] : MsgCommand.buildInlineCallbackButton(chatId, 'setting/ai/clearHistory', "清除历史记录")),
      ],
      // isEnableAi ?
      // [
      //   ...MsgCommand.buildInlineCallbackButton(chatId, 'setting/export/image', "导出 Image"),
      //   ...MsgCommand.buildInlineCallbackButton(chatId, 'setting/export/markdown', "导出 Markdown"),
      // ]:[],
    ];

    if (isMyBot) {
      const t = MsgCommand.buildInlineOpenProfileBtn(chatId, "修改机器人");
      // @ts-ignore
      res.push([...t]);
      //
      // res.push([
      //   ...MsgCommand.buildInlineCallbackButton(this.chatId, "setting/shareBot", "分享机器人")
      // ]);
    }

    res.push(
      [
        ...MsgCommand.buildInlineCallbackButton(chatId, '/setting/copyBot', "复制机器人"),
      ],
    );
    res.push(
      [
        ...MsgCommand.buildInlineCallbackButton(chatId, 'setting/advance', "高级"),
      ],
    );

    res.push([
      {
        data: `${chatId}/${outGoingMsgId ? `${outGoingMsgId}/` : ""}setting/cancel`,
        text: "取消",
        type: "callback"
      },
    ]);
    return res;
  }

  async export(messageId: number, type: string) {
    const global = getGlobal();
    const {chatGptAskHistory} = global;
    const messageIds: number[] = [];
    if (!chatGptAskHistory || !chatGptAskHistory[this.chatId]) {
      MsgDispatcher.showNotification("没有找到ai聊天记录");
      return;
    }
    Object.keys(chatGptAskHistory[this.chatId])
      .forEach((id) => {
        const msgId = parseInt(id);
        const userMsgId = chatGptAskHistory[this.chatId][msgId];
        messageIds.push(userMsgId);
        messageIds.push(msgId);
      });

    if (messageIds.length == 0) {
      return MsgDispatcher.showNotification("not found ai message");
    }
    showBodyLoading(true);
    const file_name = "chat_" + this.chatId;
    switch (type) {
      case "pdf":
      case "image":
        const url = await generateImageFromDiv(
          messageIds.map(id => `message${id}`),
          20,
          "#99BA92",
          WaterMark,
          type
        );
        if (type === 'image') {
          downloadFromLink(file_name + ".png", url);
        } else {
          downloadFromLink(file_name + ".pdf", url);
        }
        break;
      case "markdown":
        const messages = messageIds.map((id, i) => {
          const message = selectChatMessage(global, this.chatId, id);
          if (i % 2 === 0) {
            return `Q:\n-----------\n${message?.content.text?.text}\n`;
          } else {
            return `A:\n-----------\n${message?.content.text?.text}\n\n`;
          }
        })
          .join("\n");
        const blob = new Blob([messages], {type: 'text/plain'});
        downloadFromLink(file_name + ".md", URL.createObjectURL(blob));
        break;
    }
    showBodyLoading(false);
    return STOP_HANDLE_MESSAGE;
  }

  async toggleClearHistory(messageId: number, outGoingMsgId: number) {
    const disableClearHistory = this.getAiBotConfig('disableClearHistory');
    await this.changeAiBotConfig({
      "disableClearHistory": !disableClearHistory
    });
    await this.chatMsg.update(messageId, {
      inlineButtons: this.getInlineButtons(outGoingMsgId)
    });
  }

  async setting(outGoingMsgId: number) {
    new MsgCommand(this.chatId).reloadCommands(ChatMsg.getCmdList(this.chatId,this.getAiBotConfig("enableAi") as boolean));
    const text = `设置面板`;
    return this.chatMsg.setText(text)
      .setInlineButtons(this.getInlineButtons(outGoingMsgId))
      .reply();
  }

  async start() {
    const {chatId} = this;
    if (DEBUG) {
      const global = getGlobal();
      console.log({
        user: global.users.byId[chatId],
        messages: global.messages.byChatId[chatId]
      });
    }

    const enableAi = this.getAiBotConfig('enableAi') as boolean

    new MsgCommand(this.chatId).reloadCommands(ChatMsg.getCmdList(this.chatId,enableAi));

    const welcome = this.getChatGptConfig("welcome") as string;
    const template = this.getChatGptConfig("template") as string;
    const init_system_content = this.getChatGptConfig("init_system_content") as string;

    if (init_system_content) {
      await new ChatMsg(this.chatId).setText(init_system_content)
        .setSenderId("1")
        .setIsOutgoing(!enableAi)
        .reply();
    }
    if (welcome) {
      await new ChatMsg(this.chatId).setText(welcome)
        .setIsOutgoing(!enableAi)
        .reply();
    }
    if (template) {
      await new ChatMsg(this.chatId).setText("\n```\n" + template + "```")
        .setIsOutgoing(!enableAi)
        .setInlineButtons([
          MsgCommand.buildInlineCallbackButton(this.chatId, "ai/send/template", "编辑发送")
        ])
        .reply();
    }

    if (!welcome && !template) {
      await this.help();
    }

    return STOP_HANDLE_MESSAGE;
  }

  async help() {
    const commands = this.getBotInfo()?.commands;
    const help = commands!.map((cmd: { command: any; description: any; }) => {
      return `⚪ /${cmd.command} ${cmd.description}`;
    })
      .join("\n");

    return await this.chatMsg.setText(`\n通过以下指令来控制我:

${help}

- ↩️ 使用 control + enter 换行
- 🎤 长按消息输入框可识别语音进行输入
    `)
      .setInlineButtons([
        MsgCommand.buildInlineCallbackButton(this.chatId, `${this.outGoingMsgId}/setting/cancel`, '取消')
      ])
      .reply();
  }

  formatEditableText(val?: string, tips?: string) {
    return "```\n" + (val || " ") + "```\n\n" + tips;
  }

  async welcome() {
    const welcome = this.getChatGptConfig("welcome") as string;
    return await this.chatMsg.setInlineButtons([
      MsgCommand.buildInlineCallbackButton(this.chatId, "welcome", "点击修改"),
      MsgCommand.buildInlineCallbackButton(this.chatId, `${this.outGoingMsgId}/setting/cancel`, "取消"),
    ])
      .setText(this.formatEditableText(welcome, "欢迎语:当输入 /start 时显示"))
      .reply();
  }

  async template() {
    const template = this.getChatGptConfig("template") as string;
    return await this.chatMsg.setInlineButtons([
      MsgCommand.buildInlineCallbackButton(this.chatId, "template", "点击修改"),
      MsgCommand.buildInlineCallbackButton(this.chatId, `${this.outGoingMsgId}/setting/cancel`, "取消"),
    ])
      .setText(this.formatEditableText(template, "用于提示用户的提问例子。" + (template ? "" : `

如:

- 主题：在线学习的好处
- 长度：500字
- 风格：信息性
    `)))
      .reply();
  }

  async templateSubmit() {
    let templateSubmit = this.getChatGptConfig("templateSubmit") as string;
    let tips = "\n\n如:";
    tips += "\n```\n请将: ${text}，翻译成：中文 , 输出格式为:{\"reply\":\"\"}```";
    tips += "\n假设你的提问是：hello , 那么您将得到输出：{\"reply\":\"你好\"}";

    if (!MsgCommandChatGpt.isMyBot(this.chatId)) {
      tips += "\n\n你可以 /setting > 复制机器人 修改此选项";
      if (!templateSubmit) {
        templateSubmit = "未设置";
      }
    }
    return await this.chatMsg.setInlineButtons(MsgCommandChatGpt.isMyBot(this.chatId) ? [
      MsgCommand.buildInlineCallbackButton(this.chatId, "templateSubmit", "点击修改"),
      MsgCommand.buildInlineCallbackButton(this.chatId, `${this.outGoingMsgId}/setting/cancel`, "取消"),
    ] : [
      MsgCommand.buildInlineCallbackButton(this.chatId, `${this.outGoingMsgId}/setting/cancel`, "取消"),
    ])
      .setText(this.formatEditableText(templateSubmit, "用于提问模版或者强制输出格式。" + tips))
      .reply();
  }

  async systemPrompt() {
    let init_system_content = this.getChatGptConfig("init_system_content") as string;
    let tips = "";
    if (!MsgCommandChatGpt.isMyBot(this.chatId)) {
      tips += "\n\n你可以 /setting > 复制机器人 修改此选项";
      if (!init_system_content) {
        init_system_content = "未设置";
      }
    }
    const role = " ```\n我希望你能担任一名翻译官 ``` "
    return this.chatMsg.setText(this.formatEditableText(init_system_content, `用于指定机器人角色,每次提问都会带入. 如：${role}
     ${tips}`))
      .setInlineButtons(MsgCommandChatGpt.isMyBot(this.chatId) ? [
        MsgCommand.buildInlineCallbackButton(this.chatId, `init_system_content`, "点击修改"),
        MsgCommand.buildInlineCallbackButton(this.chatId, `${this.outGoingMsgId}/setting/cancel`, "取消"),
      ] : [
        MsgCommand.buildInlineCallbackButton(this.chatId, `${this.outGoingMsgId}/setting/cancel`, "取消"),
      ])
      .reply();
  }

  getAiBotConfig(key: 'enableAi' | 'botApi' | 'commandsFromApi' | 'chatGptConfig' | 'disableClearHistory') {
    const botInfo = this.getBotInfo();
    if(key === 'enableAi' && botInfo && botInfo.botId < SERVER_USER_ID_START){
      return true
    }
    if (
      botInfo &&
      botInfo.aiBot
    ) {
      return botInfo.aiBot[key];
    } else {
      return undefined;
    }
  }

  getBotInfo() {
    const global = getGlobal();
    const user = selectUser(global, this.chatId);
    if (
      user?.fullInfo &&
      user?.fullInfo.botInfo
    ) {
      return user?.fullInfo.botInfo;
    } else {
      return undefined;
    }
  }

  getChatGptConfig(key:
    'api_key' |
    'max_history_length' |
    'init_system_content' |
    'modelConfig' |
    'welcome' |
    'template' |
    'outputText' |
    'templateSubmit'
  ) {
    if (key === "api_key") {
      return localStorage.getItem("cg-key") || "";
    }
    const aiBotConfig = this.getAiBotConfig("chatGptConfig") as PbChatGpBotConfig_Type;
    if (aiBotConfig && aiBotConfig[key] !== undefined) {
      return aiBotConfig[key];
    } else {
      if (key === "modelConfig") {
        return ChatModelConfig;
      }

      if (key === "max_history_length") {
        return -1;
      }
      return "";
    }
  }

  getChatGptModelConfig(key: 'model' | 'temperature' | 'max_tokens' | 'presence_penalty') {
    const modelConfig = this.getChatGptConfig("modelConfig") as PbChatGptModelConfig_Type;
    if (modelConfig && undefined !== modelConfig[key]) {
      return modelConfig[key];
    } else {
      return ChatModelConfig[key];
    }
  }

  changeAiBotConfig(aiConfig: Partial<PbAiBot_Type>) {
    let global = getGlobal();
    const user = selectUser(global, this.chatId);
    const cmds = user!.fullInfo!.botInfo?.commands;

    global = updateUser(global, this.chatId, {
      ...user,
      updatedAt: currentTs(),
      fullInfo: {
        ...user?.fullInfo,
        botInfo: {
          ...user?.fullInfo?.botInfo!,
          aiBot: {
            ...user?.fullInfo?.botInfo?.aiBot,
            ...aiConfig
          }
        }
      }
    });
    setGlobal(global);
    setTimeout(() => {
      //@ts-ignore
      new MsgCommand(this.chatId).reloadCommands(cmds);
    }, 1000);
    if (MsgCommandChatGpt.isMyBot(this.chatId)) {
      MsgCommand.uploadUser(getGlobal(), this.chatId)
        .catch(console.error);
    }
  }

  changeChatGptConfig(chatGptConfig: Partial<PbChatGpBotConfig_Type>) {
    let global = getGlobal();
    const user = selectUser(global, this.chatId);
    this.changeAiBotConfig({
      ...user?.fullInfo?.botInfo?.aiBot,
      chatGptConfig: {
        ...user?.fullInfo?.botInfo?.aiBot?.chatGptConfig,
        ...chatGptConfig
      }
    });
  }

  changeChatGptModelConfig(chatGptModelConfig: Partial<PbChatGptModelConfig_Type>) {
    const modelConfig = this.getChatGptConfig("modelConfig") as PbChatGptModelConfig_Type;
    this.changeChatGptConfig({
      modelConfig: {
        ...modelConfig,
        ...chatGptModelConfig
      }
    });
  }

  async maxHistoryLength() {
    let max_history_length = this.getChatGptConfig("max_history_length");
    const {value} = await showModalFromEvent({
      initVal: (max_history_length || 0).toString(),
      title: "请输入携带历史消息数",
      inputType: "number",
      placeholder: "每次提问携带历史消息数,当为 0 时不携带,须为偶数"
    });
    if (value && value !== max_history_length) {
      max_history_length = isPositiveInteger(value) ? parseInt(value) : 0;
      this.changeChatGptConfig({max_history_length});
      return this.chatMsg.setText("修改成功")
        .reply();
    }
    return STOP_HANDLE_MESSAGE;
  }

  async usage(outGoingMsgId: number) {
    const api_key = this.getChatGptConfig("api_key");
    const msg = await this.chatMsg.setThinking()
      .reply();
    const inlineButtons1 = [
      MsgCommand.buildInlineCallbackButton(this.chatId, `${outGoingMsgId}/setting/cancel`, "取消")
    ];
    try {
      await sleep(500);
      // @ts-ignore
      const {text,inlineButtons} = await requestUsage(api_key);
      await this.chatMsg.update(msg.id, {
        content: {
          text: {
            text
          }
        },
        inlineButtons: [
          ...inlineButtons,
          ...inlineButtons1
        ]
      });
    } catch (e) {
      console.error(e);
      await this.chatMsg.update(msg.id, {
        content: {
          text: {
            text: "查询失败"
          }
        },
        inlineButtons: inlineButtons1
      });
    }
    return STOP_HANDLE_MESSAGE;
  }
  async prompts(){
    await new MsgCommand(this.chatId).handleCallbackButton("server/api/prompts",this.outGoingMsgId)
    return STOP_HANDLE_MESSAGE;
  }
  async apiKey() {
    const api_key = localStorage.getItem("cg-key") || "";
    const {value} = await showModalFromEvent({
      initVal: api_key,
      title: "请输入apiKey",
      placeholder: "你可以使用自己的 api_key"
    });
    if (value !== api_key) {
      localStorage.setItem("cg-key", value || "");
      MsgDispatcher.showNotification("修改成功");
    }
    return STOP_HANDLE_MESSAGE;
  }

  async reset() {
    const global = getGlobal();
    const {chatId} = this;
    setGlobal({
      ...global,
      chatGptAskHistory: {
        ...global.chatGptAskHistory,
        [chatId]: {}
      }
    });
    await this.chatMsg.setText("重置将清除每次请求携带AI对话记录,此功能只对 /maxHistoryLength > 0  有效，但不会删除消息记录")
      .setInlineButtons([
        MsgCommand.buildInlineCallbackButton(this.chatId, `ai/reset/confirm`, "确定"),
        MsgCommand.buildInlineCallbackButton(this.chatId, `${this.outGoingMsgId}/setting/cancel`, "取消")
      ])
      .reply();
    return STOP_HANDLE_MESSAGE;
  }

  async enableAi() {
    const isEnable = this.getAiBotConfig("enableAi");
    return this.chatMsg.setText(`当前AI状态:【${isEnable ? "开启" : "关闭"}】，修改请点击下面按钮:`)
      .setInlineButtons([
        [
          {
            text: isEnable ? "关闭" : "开启",
            type: "callback",
            data: `${this.chatId}/enableAi/${isEnable ? "0" : "1"}`
          }
        ]
      ])
      .reply();
  }

  getShareBotCatsInlineButtons() {
    const buttons = [];
    const {topCats} = getGlobal();
    let canStop = false;
    if (topCats.cats) {
      let row = [];
      const cats = topCats.cats.slice(1);
      for (let i = 0; i < cats.length; i++) {
        const title = cats[i].title;
        if (cats[i].botIds.includes(this.chatId)) {
          canStop = true;
          row.push(...MsgCommand.buildInlineButton(this.chatId, title, "unsupported"));
        } else {
          row.push(...MsgCommand.buildInlineCallbackButton(this.chatId, "setting/shareBot/" + title, title));
        }

        if ((i + 1) % 4 === 0) {
          buttons.push(row);
          row = [];
        }
      }
    }
    if (canStop) {
      buttons.push([
        ...MsgCommand.buildInlineCallbackButton(this.chatId, "setting/stopShareBot/confirm", "取消分享")
      ]);
    }
    return {
      buttons,
      canStop
    };
  }

  getShareBotInlineButtons(messageId: number) {
    let {buttons} = this.getShareBotCatsInlineButtons();
    const chatId = this.chatId;

    return [
      ...buttons,
      [
        ...MsgCommand.buildInlineBackButton(chatId, messageId, 'setting/ai/back', "< 返回"),
      ]
    ];
  }

  getCopyBotInlineButtons(messageId: number) {
    const chatId = this.chatId;
    return [
      [
        ...MsgCommand.buildInlineCallbackButton(chatId, 'setting/copyBot/confirm', "下一步"),
      ],
      [
        ...MsgCommand.buildInlineBackButton(chatId, messageId, 'setting/ai/back', "< 返回"),
      ]
    ];
  }

  getAdvanceInlineButtons(messageId: number) {
    const chatId = this.chatId;
    return [
      // [
      //   ...MsgCommand.buildInlineCallbackButton(chatId, 'setting/ai/setApi', botApi ? "修改Api" : "设置Api"),
      //   ...(botApi ? MsgCommand.buildInlineCallbackButton(chatId, this.outGoingMsgId + '/setting/ai/disableApi', "禁用Api") : []),
      //   ...(botApi ? MsgCommand.buildInlineCallbackButton(chatId, 'setting/ai/updateCmd', "更新命令") : []),
      // ],
      [
        ...MsgCommand.buildInlineCallbackButton(chatId, 'setting/advance/link/dd', "关联钉钉机器人"),
        ...MsgCommand.buildInlineCallbackButton(chatId, 'setting/advance/link/tg', "关联Telegram机器人"),
      ],
      [
        ...MsgCommand.buildInlineCallbackButton(chatId, 'setting/advance/sign', "签名授权"),
      ],
      [
        ...MsgCommand.buildInlineBackButton(chatId, messageId, 'setting/ai/back', "< 返回"),
      ]
    ];
  }

  async copyBot(messageId: number) {
    await this.chatMsg.update(messageId, {
      content: {
        text: {
          text: "点击 下一步，复制机器人"
        }
      },
      inlineButtons: this.getCopyBotInlineButtons(messageId)
    });
  }

  async stopShareBot(messageId: number) {
    const {chatId} = this;
    try {
      showBodyLoading(true);
      const global = getGlobal();
      const {topCats} = global;
      topCats.cats?.forEach(cat => {
        if (cat.botIds.includes(chatId)) {
          cat.botIds = cat.botIds.filter(id => id !== chatId);
        }
      });
      //@ts-ignore
      setGlobal({
        ...global,
        topCats
      });
      const res = await callApiWithPdu(new ShareBotStopReq({
        userId: this.chatId,
      }).pack());
      if (res && res.pdu) {
        const {err} = ShareBotStopRes.parseMsg(res.pdu);
        if (err === ERR.NO_ERROR) {
          MsgDispatcher.showNotification("操作成功");
          const buttons1 = selectChatMessage(getGlobal(), chatId, messageId)?.inlineButtons!;
          const {buttons} = this.getShareBotCatsInlineButtons();
          await new ChatMsg(chatId).update(messageId, {
            inlineButtons: [
              ...buttons,
              ...buttons1.slice(buttons1.length - 1),
            ]
          });
          showBodyLoading(false);
          return;
        }
      }
    } catch (e) {
      MsgDispatcher.showNotification("操作失败");
      console.error(e);
    }
    showBodyLoading(false);
  }

  async shareBotConfirm(messageId: number, data: string) {
    const {chatId} = this;
    let catTitle = data.split("/")[data.split("/").length - 1];
    showBodyLoading(true);
    let global = getGlobal();
    const user = selectUser(global, chatId);
    const {topCats} = global;
    topCats.cats?.forEach(cat => {
      if (cat.title === catTitle) {
        cat.botIds.push(chatId);
      } else {
        cat.botIds = cat.botIds.filter(id => id !== chatId);
      }
    });

    global = updateUser(getGlobal(), chatId, {
      updatedAt: currentTs()
    });
    //@ts-ignore
    setGlobal({
      ...global,
      topCats
    });
    global = getGlobal();
    await MsgCommand.uploadUser(global, chatId);
    catTitle = catTitle.trim();
    const res = await callApiWithPdu(new ShareBotReq({
      catTitle,
      catBot: {
        "time": 0,
        "cat": "",
        "userId": chatId,
        "firstName": user?.firstName || "",
        "avatarHash": user?.avatarHash,
        "bio": user?.fullInfo?.bio,
        "init_system_content": this.getChatGptConfig("init_system_content") as string,
        "welcome": this.getChatGptConfig("welcome") as string,
        "template": this.getChatGptConfig("template") as string,
        "outputText": this.getChatGptConfig("outputText") as string,
        "templateSubmit": this.getChatGptConfig("templateSubmit") as string,
      }
    }).pack());
    if (res) {
      MsgDispatcher.showNotification("分享成功");
      const buttons1 = selectChatMessage(getGlobal(), chatId, messageId)?.inlineButtons!;
      let {buttons} = this.getShareBotCatsInlineButtons();
      await new ChatMsg(chatId).update(messageId, {
        inlineButtons: [
          ...buttons,
          ...buttons1.slice(buttons1.length - 1),
        ]
      });

    }
    showBodyLoading(false);
  }

  async shareBot(messageId: number) {
    await this.chatMsg.update(messageId, {
      content: {
        text: {
          text: "选择分类"
        }
      },
      inlineButtons: this.getShareBotInlineButtons(messageId)
    });
  }

  async advance(messageId: number) {
    await this.chatMsg.update(messageId, {
      content: {
        text: {
          text: "高级"
        }
      },
      inlineButtons: this.getAdvanceInlineButtons(messageId)
    });
  }
  async disableApi(messageId: number) {
    this.changeAiBotConfig({
      botApi: undefined
    });
    const inlineButtons = this.getAdvanceInlineButtons(messageId);
    const message = selectChatMessage(getGlobal(), this.chatId, messageId);
    this.chatMsg.update(messageId, {
      content: {
        text: {
          text: "请输入api地址"
        }
      },
      inlineButtons: [
        ...inlineButtons.slice(0, inlineButtons.length - 1),
        ...message!.inlineButtons!.slice(inlineButtons.length - 1)
      ]
    });
  }

  async setApi(messageId: number) {
    let botApi = this.getAiBotConfig('botApi') as string | undefined;
    const {value} = await showModalFromEvent({
      title: "请输入api地址",
      initVal: botApi || ""
    });
    botApi = value;
    this.changeAiBotConfig({
      botApi: value
    });
    const inlineButtons = this.getAdvanceInlineButtons(messageId);
    const message = selectChatMessage(getGlobal(), this.chatId, messageId);
    this.chatMsg.update(messageId, {
      content: {
        text: {
          text: botApi ? `地址: ${botApi}` : "请输入api地址"
        }
      },
      inlineButtons: [
        ...inlineButtons.slice(0, inlineButtons.length - 1),
        ...message!.inlineButtons!.slice(inlineButtons.length - 1)
      ]
    });
  }

  getAiModelInlineButtons(outGoingMsgId: number) {
    const chatId = this.chatId;
    const modelConfig = this.getChatGptConfig("modelConfig") as PbChatGptModelConfig_Type;
    const models = ALL_CHAT_GPT_MODELS.filter(({name}) => name !== modelConfig.model)
      .map(({name}) => {
        return MsgCommand.buildInlineCallbackButton(chatId, outGoingMsgId + "/model/switch/" + name, "# " + name);
      });
    return [
      [...MsgCommand.buildInlineCallbackButton(chatId, outGoingMsgId + "/model/property/temperature", "> 随机性 (temperature): " + modelConfig.temperature)],
      [...MsgCommand.buildInlineCallbackButton(chatId, outGoingMsgId + "/model/property/max_tokens", "> 单次回复限制 (max_tokens): " + modelConfig.max_tokens)],
      [...MsgCommand.buildInlineCallbackButton(chatId, outGoingMsgId + "/model/property/presence_penalty", "> 话题新鲜度 (presence_penalty): " + modelConfig.presence_penalty)],
      [...MsgCommand.buildInlineButton(chatId, "切换其他模型", "unsupported")],
      ...models,
      [...MsgCommand.buildInlineCallbackButton(chatId, `${outGoingMsgId}/` + "setting/cancel", "取消")],
    ];
  }
  async aiBotPublic(){
    await new MsgCommand(this.chatId).handleCallbackButton("server/api/bot/public");
    return true;
    //
    // const inlineButtons: ApiKeyboardButtons = [
    //   [...MsgCommand.buildInlineCallbackButton(this.chatId, outGoingMsgId + "/model/property/temperature", "开启")],
    //   [...MsgCommand.buildInlineCallbackButton(this.chatId, outGoingMsgId + "/model/property/temperature", "关闭")],
    //   [...MsgCommand.buildInlineCallbackButton(this.chatId, `${outGoingMsgId}/` + "setting/cancel", "取消")],
    // ];
    // return this.chatMsg.setText(`公开机器人，分享好友，赚钱Token使用的 5%`)
    //   .setInlineButtons(inlineButtons)
    //   .reply();
  }
  async aiModel(outGoingMsgId: number) {
    const modelConfig = this.getChatGptConfig("modelConfig") as PbChatGptModelConfig_Type;
    const inlineButtons: ApiKeyboardButtons = this.getAiModelInlineButtons(outGoingMsgId) as ApiKeyboardButtons;
    return this.chatMsg.setText(`当前模型:【${modelConfig.model}】`)
      .setInlineButtons(inlineButtons)
      .reply();
  }

  async handleChangeModelConfig(messageId: number, key: 'model' | 'temperature' | 'max_tokens' | 'presence_penalty', data: string) {
    const outGoingMsgId = data.split("/")[data.split("/").length - 4];
    const val: any = this.getChatGptModelConfig(key);
    let title = "";
    let placeholder = "";
    let step = 1;
    let max = 2;
    let min = 0;
    switch (key) {
      case "temperature":
        step = 0.1;
        title = "随机性 (temperature)";
        placeholder = "值越大，回复越随机";
        break;
      case "max_tokens":
        step = 1;
        max = 4096;
        min = 100;
        title = "单次回复限制 (max_tokens)";
        placeholder = "单次交互所用的最大 Token 数";
        break;
      case "presence_penalty":
        step = 0.5;
        max = 2;
        min = -2;
        title = "话题新鲜度 (presence_penalty)";
        placeholder = "值越大，越有可能扩展到新话题";
        break;
    }
    const initVal = val === 0 ? "0" : val;
    const {value} = await showModalFromEvent({
      title,
      placeholder,
      type: 'singleInput',
      inputType: "number",
      initVal,
      step,
      min,
      max
    });

    if (value !== val) {
      this.changeChatGptModelConfig({
        [key]: Number(value)
      });
    }
    const inlineButtons: ApiKeyboardButtons = this.getAiModelInlineButtons(Number(outGoingMsgId));
    this.chatMsg.update(messageId, {
      inlineButtons
    });

  }

  async switchModel(messageId: number, data: string) {
    const outGoingMsgId = data.split("/")[data.split("/").length - 4];
    const chatId = this.chatId;
    const model = data.replace(`${chatId}/${outGoingMsgId}/model/switch/`, "");
    this.changeChatGptModelConfig({
      model
    });
    const inlineButtons: ApiKeyboardButtons = this.getAiModelInlineButtons(Number(outGoingMsgId)) as ApiKeyboardButtons;
    await new ChatMsg(this.chatId).update(messageId, {
      inlineButtons,
      content: {
        text: {
          text: `当前模型:【${model}】`
        }
      }
    });
  }

  async ai(){
    const buttons = [
      MsgCommand.buildInlineCallbackButton(this.chatId, "ai/setting/systemPrompt", "系统 Prompt"),
      MsgCommand.buildInlineCallbackButton(this.chatId, "ai/setting/maxHistoryLength", "每次提问携带历史消息数"),
      MsgCommand.buildInlineCallbackButton(this.chatId, "ai/setting/reset", "重置ai记忆"),
      MsgCommand.buildInlineCallbackButton(this.chatId, "ai/setting/template", "提问示例"),
      MsgCommand.buildInlineCallbackButton(this.chatId, "ai/setting/templateSubmit", "提问模版"),
      [
        ...MsgCommand.buildInlineCallbackButton(this.chatId, "ai/setting/aiModel", "配置AI模型"),
        ...MsgCommand.buildInlineCallbackButton(this.chatId, "ai/setting/apiKey", "自定义apiKey"),
      ],
    ];

    if(MsgCommandChatGpt.isMyBot(this.chatId)){
      buttons.push(MsgCommand.buildInlineCallbackButton(this.chatId, "ai/setting/bot/public", "设为公开机器人(赚佣金)"))
    }

    buttons.push(MsgCommand.buildInlineCallbackButton(this.chatId, `${this.outGoingMsgId}/setting/cancel`, "取消"))

    await this.chatMsg.setInlineButtons(buttons)
      .setText("Ai 设置")
      .reply();
    return STOP_HANDLE_MESSAGE;
  }
  async answerCallbackButton(global: GlobalState, messageId: number, data: string) {
    const chatId = this.chatId;
    if (data.startsWith(`${chatId}/setting/ai/back`)) {
      await new MsgCommand(chatId).back(global, messageId, data, "setting/ai/back");
      return;
    }
    if (data.includes(`/model/switch/`)) {
      await this.switchModel(messageId, data);
      return;
    }

    if (data.endsWith(`setting/ai/toggleClearHistory`)) {
      const outGoingMsgId = data.split("/")[data.split("/").length - 4];
      await this.toggleClearHistory(messageId, Number(outGoingMsgId));
      return;
    }
    if (data.endsWith(`model/property/temperature`)) {
      await this.handleChangeModelConfig(messageId, "temperature", data);
      return;
    }

    if (data.endsWith(`model/property/max_tokens`)) {
      await this.handleChangeModelConfig(messageId, "max_tokens", data);
      return;
    }

    if (data.endsWith(`model/property/presence_penalty`)) {
      await this.handleChangeModelConfig(messageId, "presence_penalty", data);
      return;
    }

    if (data.includes(`setting/ai/enable`)) {
      const isEnable = data.endsWith("setting/ai/enable/1");
      const outGoingMsgId = data.split("/")[data.split("/").length - 5];

      this.changeAiBotConfig({
        enableAi: isEnable
      });
      await this.chatMsg.update(messageId, {
        inlineButtons: this.getInlineButtons(Number(outGoingMsgId))
      });
      return;
    }
    if (data.endsWith(`setting/uploadUser`)) {
      const outGoingMsgId = data.split('/')[data.split("/").length - 3];
      await this.chatMsg.setText("Wai遵循本地优先策略,上传机器人将会覆盖云端资料,点击 上传机器人 进入下一步")
        .setInlineButtons([
          MsgCommand.buildInlineCallbackButton(this.chatId, `/setting/uploadUser/confirm`, "上传机器人"),
          MsgCommand.buildInlineCallbackButton(this.chatId, `${outGoingMsgId}/setting/cancel`, "取消")
        ])
        .reply();
      return;
    }

    if (data.endsWith(`setting/shareBot`)) {
      await this.shareBot(messageId);
      return;
    }

    if (data.indexOf(`setting/shareBot/`) > -1) {
      await this.shareBotConfirm(messageId, data);
      return;
    }
    if (data.endsWith(`setting/copyBot`)) {
      await this.copyBot(messageId);
      return;
    }

    if (data.endsWith(`setting/ai/disableApi`)) {
      const outGoingMsgId = data.split('/')[data.split("/").length - 4];
      this.setOutGoingMsgId(Number(outGoingMsgId));
      await this.chatMsg.setText("点击 禁用 进入下一步")
        .setInlineButtons([
          MsgCommand.buildInlineCallbackButton(this.chatId, `setting/ai/disableApi/confirm`, "禁用"),
          MsgCommand.buildInlineCallbackButton(this.chatId, `${outGoingMsgId}/setting/cancel`, "取消")
        ])
        .reply();
      return;
    }

    switch (data) {
      case `${chatId}/ai/setting/systemPrompt`:
        return await this.systemPrompt()
      case `${chatId}/ai/setting/maxHistoryLength`:
        return await this.maxHistoryLength()
      case `${chatId}/ai/setting/aiModel`:
        return await this.aiModel(0)
      case `${chatId}/ai/setting/bot/public`:
        return await this.aiBotPublic()
      case `${chatId}/ai/setting/templateSubmit`:
        return await this.templateSubmit()
      case `${chatId}/ai/setting/welcome`:
        return await this.welcome()
      case `${chatId}/ai/setting/apiKey`:
        return await this.apiKey()
      case `${chatId}/ai/setting/template`:
        return await this.template()
      case `${chatId}/ai/setting/reset`:
        return await this.reset()
      case `${chatId}/setting/advance/link/dd`:
      case `${chatId}/setting/advance/link/tg`:
        await this.advanceLink(chatId,data)
        return
      case `${chatId}/setting/advance/sign`:
        const {password} = await getPasswordFromEvent(
          undefined,true,
          "mnemonicPasswordVerify",
          false,
          {
            title:"账户助记词密码"
          }
        )
        const verifyRes = await Account.getCurrentAccount()?.verifySession(Account.getCurrentAccount()?.getSession()!,password!)
        if(!verifyRes){
          MsgDispatcher.showNotification("密码不正确")
          return
        }else{
          const resSign = await Account.getCurrentAccount()?.signMessage(`${chatId}`,hashSha256(password!))
          const sign = `s_${resSign!.sign.toString("hex")}__${chatId}`
          await showModalFromEvent({
            title:"签名授权",
            type: 'multipleInput',
            initVal:sign,
            buttonTxt:"关闭",
          });
        }
        return
      case `${chatId}/ai/send/template`:
        const message = selectChatMessage(global, this.chatId, messageId);
        const text = message?.content.text?.text!.trim();
        // @ts-ignore
        document.querySelector('#editable-message-text').focus();
        document.execCommand('insertText', false, text);
        return;

      case `${chatId}/setting/doSwitchAccount`:
        await this.settingDoSwitchAccount(chatId,messageId)
        break;
      case `${chatId}/setting/ai/disableApi/confirm`:
        await this.disableApi(messageId);
        return;
      case `${chatId}/setting/ai/setApi`:
        await this.setApi(messageId);
        return;
      case `${chatId}/setting/advance`:
        await this.advance(messageId);
        return;
      case `${chatId}/setting/export/markdown`:
      case `${chatId}/setting/export/image`:
        await this.export(messageId, data.replace(`${chatId}/setting/export/`, ""));
        return;
      case `${chatId}/setting/uploadUser/confirm`:
        await MsgCommand.uploadUser(global, chatId);
        return;
      case `${chatId}/setting/downloadUser/confirm`:
        await MsgCommand.downloadUser(chatId);
        return;
      case `${chatId}/setting/downloadMsg/confirm`:
        // await new MsgCommand(chatId).downloadMsg(global,messageId)
        return;
      case `${chatId}/setting/copyBot/confirm`:
        await new MsgCommand(chatId).copyBot(global, messageId);
        break;
      case `${chatId}/setting/stopShareBot/confirm`:
        await this.stopShareBot(messageId);
        break;
      case `${chatId}/setting/shareBot/confirm`:
        await this.shareBot(messageId);
        break;
      case `${chatId}/setting/ai/clearHistory`:
        await new MsgCommand(chatId).clearHistory();
        break;
      case `${chatId}/requestChatStream/retry`:
        await this.chatMsg.update(messageId, {
          inlineButtons: []
        });
        await MsgDispatcher.retryAi(chatId, messageId);
        break;
      case `${chatId}/requestChatStream/stop`:
        await callApiWithPdu(new StopChatStreamReq({
          chatId: parseInt(chatId),
          msgId: messageId
        }).pack());
        break;
      case `${chatId}/welcome`:
      case `${chatId}/template`:
      case `${chatId}/templateSubmit`:
      case `${chatId}/init_system_content`:
        global = getGlobal();
        const e = document.querySelector("#message" + messageId + " pre.text-entity-pre");
        if (e) {
          const btn = document.querySelector("#message" + messageId + " .InlineButtons .inline-button-text");
          // @ts-ignore
          document.querySelector("#message" + messageId + " pre.text-entity-pre .code-overlay")!.style.display = "block";

          // @ts-ignore
          if (e.contentEditable === "true") {
            // @ts-ignore
            btn.innerText = "点击修改";
            // @ts-ignore
            e.contentEditable = false;
            // @ts-ignore
            e.blur();
          } else {
            // @ts-ignore
            document.querySelector("#message" + messageId + " pre.text-entity-pre .code-overlay")!.style.display = "none";
            // @ts-ignore
            btn.innerText = "保存修改";
            // @ts-ignore
            e.contentEditable = true;
            // @ts-ignore
            e.focus();
            e.addEventListener('focus', () => {
              // @ts-ignore
              btn.innerText = "保存修改";
            });
            e.addEventListener('blur', () => {
              // @ts-ignore
              // @ts-ignore
              btn.innerText = "点击修改";
              // @ts-ignore
              e.contentEditable = false;
              // @ts-ignore
              const val = e.innerText;
              if (val && val.trim() === "未设置") {
                return;
              }
              if (!val) {
                return;
              }
              const key = data.split("/")[data.split("/").length - 1];
              switch (key) {
                case "welcome":
                  this.changeChatGptConfig({
                    welcome: val.trim()
                  });
                  break;
                case "template":
                  this.changeChatGptConfig({
                    template: val.trim()
                  });
                  break;
                case "templateSubmit":
                  this.changeChatGptConfig({
                    templateSubmit: val.trim()
                  });
                  break;
                case "init_system_content":
                  this.changeChatGptConfig({
                    init_system_content: val.trim()
                  });
                  break;
              }
            });
          }

        }
        break;
    }
  }

  async advanceLink(chatId: string, data: string) {
    const key = data.replace(`${chatId}/setting/advance`,chatId)
    const res = await callApiWithPdu(new FetchBotSettingReq({
      key
    }).pack())
    if(res && res.pdu){
      let {value} = FetchBotSettingRes.parseMsg(res.pdu)
      let inputRes;
      let inputValue;
      switch (key){
        case chatId+"/link/tg":
          inputRes = await showModalFromEvent({
            title:"绑定Telegram机器人",
            type: 'singleInput',
            initVal:value || "",
            placeholder:"请输入Telegram机器人的token和聊天ID:如：token@chatId",
            buttonTxt:"下一步",
          });
          inputValue = inputRes.value || ""
          break
        case chatId+"/link/dd":
          inputRes = await showModalFromEvent({
            title:"绑定钉钉机器人",
            type: 'singleInput',
            placeholder:"请输入钉钉机器人 access_token",
            initVal:value || "",
            buttonTxt:"下一步",
          });
          inputValue = inputRes.value || ""
          break
      }
      if(inputValue !== value){
        const res1 = await callApiWithPdu(new SaveBotSettingReq({
          key,
          value:inputValue || ""
        }).pack())
        if(res1){

        }
      }
    }
  }

  async settingDoSwitchAccount(chatId: string, messageId: number,) {
    const account = Account.getCurrentAccount()!
    const entropy = await account.getEntropy();
    const mnemonic1 = Mnemonic.fromEntropy(entropy, DEFAULT_LANG_MNEMONIC as MnemonicLangEnum)
      .getWords();
    const {
      password,
      mnemonic
    } = await getPasswordFromEvent(
      undefined,
      true, "mnemonicPassword", false, {
        title: "切换账户",
        mnemonic: mnemonic1
      });
    if (password) {
      if (mnemonic === mnemonic1) {
        await this.doSwitchAccount(getGlobal(), password, messageId);
      } else {
        await this.changeMnemonic(mnemonic!, password);
      }
    }
  }

  async handleMnemonic(mnemonic: string) {
    const qrcodeData = mnemonic.replace('wai://', '');
    const qrcodeDataBuf = Buffer.from(qrcodeData, 'hex');
    const decodeRes = PbQrCode.parseMsg(new Pdu(qrcodeDataBuf));
    if (decodeRes) {
      const {
        type,
        data
      } = decodeRes;
      if (type !== QrCodeType.QrCodeType_MNEMONIC) {
        throw new Error("解析二维码失败");
      }
      const {password} = await getPasswordFromEvent(undefined, true);
      const res = await aesDecrypt(data, Buffer.from(hashSha256(password!), "hex"));
      if (res) {
        await this.changeMnemonic(res, password);
        return;
      }
    }
  }

  async changeMnemonic(words: string, password?: string) {
    const mnemonic = new Mnemonic(words);
    if (mnemonic.checkMnemonic()) {
      if (!password) {
        const res = await getPasswordFromEvent(undefined, true);
        if (res.password) {
          password = res.password;
        } else {
          return;
        }
      }
      if (password) {
        const entropy = mnemonic.toEntropy();
        let accountId = Account.getAccountIdByEntropy(entropy);
        if (!accountId) {
          accountId = Account.genAccountId();
        }
        const account = Account.getInstance(accountId);
        Account.setCurrentAccountId(accountId);
        await account?.setEntropy(entropy);
        const pwd = hashSha256(password);
        const ts = +(new Date());
        const {
          address,
          sign
        } = await account!.signMessage(ts.toString(), pwd);
        const session = Account.formatSession({
          address,
          sign,
          ts,
          accountId
        });
        account!.saveSession(session);
        setTimeout(() => window.location.reload(), 200);
      }
    } else {
      await this.chatMsg.setText("mnemonic 不合法")
        .reply();
    }
  }

  async switchAccount(messageId: number, data: string) {
    const {chatId} = this;
    const accountAddress = data.replace(`${chatId}/setting/switchAccount/account/`, '');
    const keys = Account.getKeys();
    const sessions = Account.getSessions();
    const global = getGlobal();
    if (sessions && Object.keys(sessions).length > 0) {
      for (let i = 0; i < Object.keys(sessions).length; i++) {
        const session = sessions[Object.keys(sessions)[i]];
        const res = Account.parseSession(session);
        if (res?.address === accountAddress) {
          const accountId = res.accountId;
          const account = Account.getInstance(accountId);
          if (keys[accountId]) {
            const entropy = keys[accountId];
            account?.setEntropy(entropy, true);
            const {password} = await getPasswordFromEvent(undefined, true);
            if (password) {
              const resVerify = await account?.verifySession(session, password);
              if (resVerify) {
                Account.setCurrentAccountId(accountId);
                return await this.doSwitchAccount(global, password, messageId);
              } else {
                return MsgDispatcher.showNotification("密码不正确!");
              }
            }
            break;
          }
        }
      }
    } else {
      const {password} = await getPasswordFromEvent(undefined, true);
      if (password) {
        return await this.doSwitchAccount(global, password, messageId);
      }
    }
  }

  async doSwitchAccount(global: GlobalState, password: string, messageId?: number) {
    const {chatId} = this;
    const account = Account.getCurrentAccount();
    const pwd = hashSha256(password);
    const ts = +(new Date());
    const {
      address,
      sign
    } = await account!.signMessage(ts.toString(), pwd);
    const session = Account.formatSession({
      address,
      sign,
      ts,
      accountId: account?.getAccountId()!
    });
    account!.saveSession(session);
    await account!.getEntropy();
    account!.getAccountId();
    if (chatId) {
      await this.chatMsg.update(messageId!, {
        inlineButtons: []
      });
    }
    setTimeout(() => window.location.reload(), 200);
  }

}
