import {ClientInfo_Type} from "../../lib/ptp/protobuf/PTPCommon/types";
import LocalDatabase from "../share/db/LocalDatabase";
import localDb from "../../api/gramjs/localDb";
import Account from "../share/Account";
import BotWebSocket from "./bot/BotWebSocket";
import {CHATGPT_PROXY_API, MSG_SERVER} from "../../config";
import MsgWorker from "./MsgWorker";
import {Pdu} from "../../lib/ptp/protobuf/BaseMsg";
import {AuthNativeReq} from "../../lib/ptp/protobuf/PTPAuth";
import {StopChatStreamReq} from "../../lib/ptp/protobuf/PTPOther";
import {ControllerPool, requestChatStream} from "../../lib/ptp/functions/requests";
import {ApiKeyboardButtons} from "../../api/types";
import ChatMsg from "./ChatMsg";
import {SendBotMsgReq, SendBotMsgRes, UpdateCmdReq, UpdateCmdRes} from "../../lib/ptp/protobuf/PTPMsg";

export const handleAuthNative = async (accountId: number, entropy: string, session?: string, clientInfo?: ClientInfo_Type) => {
  const kv = new LocalDatabase();
  kv.init(localDb);
  Account.setClientKv(kv);
  const account = Account.getInstance(accountId);
  account.setClientInfo(clientInfo);
  await account.setEntropy(entropy);
  Account.setCurrentAccountId(accountId);
  if (session) {
    account.saveSession(session);

    const botWs = BotWebSocket.getInstance(accountId);
    if (!botWs.isLogged() && MSG_SERVER) {
      MsgWorker.createWsBot(accountId, MSG_SERVER);
    }
  } else {
    account.delSession();
  }
};

export const handleAuthNativeReq = async (pdu: Pdu) => {
  const {
    accountId,
    entropy,
    session
  } = AuthNativeReq.parseMsg(pdu);
  await handleAuthNative(accountId, entropy, session);
};

export const handleStopChatStreamReq = async (pdu: Pdu) => {
  const {
    msgId,
    chatId
  } = StopChatStreamReq.parseMsg(pdu);
  ControllerPool.stop(chatId, msgId);
};
const replyResult: Record<string, boolean> = {};

async function handleChatGpt(url: string, chatGpt: string, chatId?: string, msgId?: number) {
  let i = 0;
  let totalContent = "";
  replyResult[`${chatId}_${msgId}`] = false;
  requestChatStream(
    url,
    {
      body: {
        ...JSON.parse(chatGpt)
        ,
        msgId,
        chatId,
        stream: true
      },
      onMessage: (content, done) => {
        if (replyResult[`${chatId}_${msgId}`]) {
          return;
        }
        let inlineButtons: ApiKeyboardButtons = [];
        if (content.startsWith("sign://401/")) {
          inlineButtons = [
            [
              {
                text: "签名",
                data: "sign://401",
                type: "callback",
              }
            ]
          ];
          content = content.replace("sign://401/", "");
          new ChatMsg(chatId!).update(msgId!, {
            content: {
              text: {
                text: content
              }
            },
            inlineButtons
          });
          return;
        }

        if (done) {
          replyResult[`${chatId}_${msgId}`] = true;
          totalContent = content;
          console.log("====>>> done", content);
          new ChatMsg(chatId!).update(msgId!, {
            content: {
              text: {
                text: content
              }
            },
            inlineButtons: []
          });
          ControllerPool.remove(parseInt(chatId!), msgId!);
        } else {
          totalContent = content;
          i++;
          if (i > 1 && content.length > 1) {
            new ChatMsg(chatId!).update(msgId!, {
              content: {
                text: {
                  text: content
                }
              },
              inlineButtons: [
                [
                  {
                    type: "callback",
                    data: chatId + "/requestChatStream/stop",
                    text: "停止输出"
                  }
                ]
              ]
            });
          } else {
            new ChatMsg(chatId!).update(msgId!, {
              content: {
                text: {
                  text: content
                }
              },
            });
          }
        }
      },
      onAbort: (error) => {
        i = 0;
        if (totalContent.length === 0) {
          new ChatMsg(chatId!).update(msgId!, {
            content: {
              text: {
                text: "user abort"
              }
            },
            inlineButtons: [
              [
                {
                  type: "callback",
                  data: `${chatId}/requestChatStream/retry`,
                  text: "重试"
                }
              ]
            ]
          });
          ChatMsg.apiUpdate({
            "@type": "updateGlobalUpdate",
            data: {
              action: "updateChatGptHistory",
              payload: {
                chatId,
                msgIdAssistant: undefined,
              }
            }
          });
        } else {
          new ChatMsg(chatId!).update(msgId!, {
            inlineButtons: [
              [
                {
                  type: "callback",
                  data: `${chatId}/requestChatStream/retry`,
                  text: "重试"
                }
              ]
            ]
          });
        }
        ControllerPool.remove(parseInt(chatId!), msgId!);
      },
      onError: (error) => {
        i = 0;
        new ChatMsg(chatId!).update(msgId!, {
          content: {
            text: {
              text: error.message
            }
          },
        });

        ChatMsg.apiUpdate({
          "@type": "updateGlobalUpdate",
          data: {
            action: "updateChatGptHistory",
            payload: {
              chatId,
              msgIdAssistant: undefined,
            }
          }
        });
        ControllerPool.remove(parseInt(chatId!), msgId!);
      },
      onController: (controller) => {
        ControllerPool.addController(
          parseInt(chatId!),
          msgId!,
          controller,
        );
      },
    })
    .catch(console.error);
}

export const handleSendBotMsgReq = async (pdu: Pdu) => {
  const account = Account.getCurrentAccount()!;
  let {
    botApi,
    chatId,
    msgId,
    chatGpt,
    text
  } = SendBotMsgReq.parseMsg(pdu);
  try {
    if (botApi && botApi.startsWith("http")) {
      if (!botApi) {
        botApi = CHATGPT_PROXY_API;
      }
      if (chatGpt) {
        let url = botApi + "/v1/chat/completions";
        await handleChatGpt(url, chatGpt, chatId, msgId);
        return new SendBotMsgRes({
          reply: "..."
        }).pack()
          .getPbData();
      } else {
        let url = botApi + "/message";
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              Authorization: `Bearer ${account.getSession()}`,
            },
            body: JSON.stringify({
              chatId,
              msgId,
              text
            })
          });
          if (!res || res.status !== 200) {
            return;
          }
          return new SendBotMsgRes({
            reply: await res.text()
          }).pack()
            .getPbData();
        } catch (e: any) {
          return new SendBotMsgRes({
            reply: "Error invoke api," + e.message
          }).pack()
            .getPbData();
        }
      }
    } else {
      const connId = botApi ? parseInt(chatId!) : Account.getCurrentAccountId();
      if (!botApi) {
        botApi = CHATGPT_PROXY_API;
      }
      const botWs = BotWebSocket.getInstance(connId);
      if (!botWs.isLogged()) {
        await MsgWorker.createWsBot(connId, botApi);
      }
      const res = await botWs.sendPduWithCallback(new SendBotMsgReq({
        text,
        chatId,
        msgId,
        chatGpt
      }).pack());
      return res.getPbData();
    }
  } catch (e) {
    console.error(e);
    return;
  }
};
