import {ApiBotInfo, ApiMessage} from "../../../api/types";
import {PbChatGptModelConfig_Type} from "../../../lib/ptp/protobuf/PTPCommon/types";
import {selectChatMessage, selectUser} from "../../../global/selectors";
import {getGlobal} from "../../../global";
import {callApiWithPdu} from "../utils";
import {SendBotMsgReq, SendBotMsgRes} from "../../../lib/ptp/protobuf/PTPMsg";
import MsgCommandChatGpt from "../MsgCommandChatGpt";
import ChatMsg from "../ChatMsg";
import {CHATGPT_PROXY_API, MSG_SERVER} from "../../../config";
import MsgDispatcher from "../MsgDispatcher";

export type AiHistoryType = {
  role: "user" | "system" | "assistant",
  content: string,
}

export default class BotChatGpt {
  private botInfo: ApiBotInfo;
  private replyMessage?: ApiMessage;
  private outGoingMsg?: ApiMessage;
  private botId: string;
  private msgCommandChatGpt: MsgCommandChatGpt;
  private chatMsg: ChatMsg;

  constructor(botId: string) {
    this.botId = botId;
    this.chatMsg = new ChatMsg(botId);
    const user = selectUser(getGlobal(), botId);
    this.botInfo = user?.fullInfo?.botInfo!;
    this.msgCommandChatGpt = new MsgCommandChatGpt(botId);
  }

  prepareSendMessages(text: string, assistantMsg?: ApiMessage) {
    const {chatGptAskHistory} = getGlobal();
    const history = chatGptAskHistory[this.botId];
    let historyList: AiHistoryType[] = [];
    const max_history_length = this.msgCommandChatGpt.getChatGptConfig("max_history_length") as number;
    if (history) {
      const global = getGlobal();
      Object.keys(history)
        .forEach(messageId => {
          const assistantMessageId = parseInt(messageId);
          const userMessageId = history[parseInt(messageId)];
          const message1 = selectChatMessage(global, this.botId, userMessageId);
          const message2 = selectChatMessage(global, this.botId, assistantMessageId);

          if (message1 && message2) {
            if (assistantMsg && userMessageId !== assistantMsg.id) {
              if (message1.id < assistantMsg.id && message2.id < assistantMsg.id) {
                historyList.push({
                  role: "user",
                  content: message1.content.text?.text!,
                });
                historyList.push({
                  role: "assistant",
                  content: message2.content.text?.text!,
                });
              }

            } else {
              historyList.push({
                role: "user",
                content: message1.content.text?.text!,
              });
              historyList.push({
                role: "assistant",
                content: message2.content.text?.text!,
              });
            }
          }
        });
    }

    if (max_history_length > 0) {
      historyList = historyList.slice(Math.max(0, historyList.length - max_history_length));
    } else {
      historyList = [];
    }

    let content = text;
    const templateSubmit = this.msgCommandChatGpt.getChatGptConfig("templateSubmit") as string;
    if (templateSubmit) {
      content = templateSubmit.replace("${text}", text);
    }
    const aiHistoryList: AiHistoryType[] = [
      ...historyList,
      {
        role: "user",
        content,
      }
    ];
    // console.log("======>>aiHistoryList",aiHistoryList)
    return aiHistoryList;
  }

  async process(outGoingMsg: ApiMessage, assistantMsg?: ApiMessage) {
    this.outGoingMsg = outGoingMsg;
    const apiKey = this.msgCommandChatGpt.getChatGptConfig("api_key") as string;
    let botApi = apiKey ? undefined : MSG_SERVER
    let thinkingMsg;
    if (assistantMsg) {
      await this.chatMsg.updateText(assistantMsg.id, "...");
      thinkingMsg = this.replyMessage = assistantMsg;
    } else {
      thinkingMsg = await this.chatMsg.setThinking()
        .reply();
    }
    try {
      if (!botApi) {
        // @ts-ignore
        botApi = CHATGPT_PROXY_API;
      }
      // debugger
      const res = await callApiWithPdu(new SendBotMsgReq({
        botApi,
        chatId: this.botId,
        msgId: thinkingMsg.id,
        msgDate: thinkingMsg.date,
        msgAskId: this.outGoingMsg.id,
        msgAskDate: this.outGoingMsg.date,
        text: undefined,
        chatGpt: JSON.stringify({
          apiKey: this.msgCommandChatGpt.getChatGptConfig("api_key")!,
          stream: true,
          ...this.msgCommandChatGpt.getChatGptConfig("modelConfig") as PbChatGptModelConfig_Type,
          systemPrompt: this.msgCommandChatGpt.getChatGptConfig("init_system_content"),
          messages: this.prepareSendMessages(this.outGoingMsg.content.text?.text!, assistantMsg),
        }),
      }).pack());
      // debugger
      ChatMsg.apiUpdate({
        "@type": "updateGlobalUpdate",
        data: {
          action: "updateChatGptHistory",
          payload: {
            chatId: this.botId,
            msgIdUser: this.outGoingMsg.id,
            msgIdAssistant: thinkingMsg.id,
          }
        }
      });
      if (res) {
        const {reply} = SendBotMsgRes.parseMsg(res.pdu);
        if (reply) {
          return this.chatMsg.updateText(thinkingMsg.id, reply);
        }
      }
    } catch (e) {
      console.error(e);
    }
    return this.chatMsg.updateText(thinkingMsg.id, "Error ask chatGpt");
  }
}
