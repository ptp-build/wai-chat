import {ApiAttachment, ApiBotInfo, ApiChat, ApiMessage, ApiUser} from "../../api/types";
import {CLOUD_WS_URL, LOCAL_MESSAGE_MIN_ID} from "../../config";
import {GenMsgIdReq, GenMsgIdRes, SendBotMsgRes, SendMsgRes, SendTextMsgReq} from "../../lib/ptp/protobuf/PTPMsg";
import {getNextLocalMessageId} from "../../api/gramjs/apiBuilders/messages";
import {Pdu} from "../../lib/ptp/protobuf/BaseMsg";
import {sleep} from "../../lib/gramjs/Helpers";
import {Api as GramJs} from "../../lib/gramjs";
import {blobToDataUri, fetchBlob} from "../../util/files";
import BotWebSocket, {BotWebSocketNotifyAction, BotWebSocketState} from "./bot/BotWebSocket";
import Account from "../share/Account";
import {ActionCommands} from "../../lib/ptp/protobuf/ActionCommands";
import ChatMsg from "./ChatMsg";
import {SyncRes, TopCatsRes} from "../../lib/ptp/protobuf/PTPSync";
import {PbMsg_Type} from "../../lib/ptp/protobuf/PTPCommon/types";
import {sendWithCallback} from "../../api/gramjs/methods";
import {PbMsg} from "../../lib/ptp/protobuf/PTPCommon";
import {MsgStreamHandler} from "./MsgStreamHandler";

let messageIds: number[] = [];


export default class MsgWorker {
  private botInfo?: ApiBotInfo;
  private chat: ApiChat;
  private msgSend: ApiMessage;
  private media: GramJs.TypeInputMedia | undefined;
  private attachment?: ApiAttachment;
  private chatMsg: ChatMsg;

  constructor({
    chat,
    msgSend,
    attachment,
    media,
    botInfo,
  }: {
    chat: ApiChat;
    media: GramJs.TypeInputMedia | undefined;
    msgSend: ApiMessage;
    attachment?: ApiAttachment;
    botInfo?: ApiBotInfo;
  }) {
    this.botInfo = botInfo;
    this.chat = chat;
    this.media = media;
    this.msgSend = msgSend;
    this.attachment = attachment;
    this.chatMsg = new ChatMsg(chat.id);
  }

  static async handleTopCatsRes(pdu: Pdu) {
    const {payload} = TopCatsRes.parseMsg(pdu);
    if (payload) {
      const topCats = JSON.parse(payload);
      if (topCats) {
        await MsgWorker.handleTopCats(topCats);
      }
    }
  }

  static async handleSyncRes(pdu: Pdu) {
    // debugger
    const {userStoreData} = SyncRes.parseMsg(pdu);
    ChatMsg.apiUpdate({
      "@type": "updateGlobalUpdate",
      data: {
        action: "updateUserStoreData",
        payload: {
          userStoreData
        },
      }
    });
  }

  static async handleSendMsgRes(pdu: Pdu) {
    const {
      replyText,
      senderId,
      date,
      chatId
    } = SendMsgRes.parseMsg(pdu);

    if(senderId !== chatId && senderId){
      ChatMsg.apiUpdate({
        "@type": "updateGlobalUpdate",
        data: {
          action: "updateUser",
          payload: {
            userId:senderId
          },
        }
      });
    }
    if(replyText){
      await new ChatMsg(chatId!).setText(replyText).setDate(date).setSenderId(senderId||chatId).reply()
    }
  }
  static async handleSendBotMsgRes(pdu: Pdu) {
    const {
      reply,
      msgId,
      msgDate,
      streamStatus,
      message,
      chatId
    } = SendBotMsgRes.parseMsg(pdu);
    console.log("[SendBotMsgRes]", reply,message);
    if (reply) {
      if (msgId) {
        if (streamStatus !== undefined && chatId) {
          await MsgStreamHandler.getInstance(chatId, msgId, msgDate!,reply, streamStatus).process();
        } else {
          await new ChatMsg(chatId!).update(msgId, {
            content: {
              text: {
                text: reply
              }
            }
          });
        }

      } else {
        await new ChatMsg(chatId!).setText(reply)
          .reply();
      }
    }
    if (message) {
      if (msgId) {
        await new ChatMsg(chatId!).update(msgId, message as ApiMessage);
      } else {
        await new ChatMsg(chatId!).sendNewMessage(message as ApiMessage);
      }
    }
  }

  static async handleTopCats(topCats: any) {
    const {
      cats,
      time,
      bots,
      topSearchPlaceHolder
    } = topCats;
    if (bots != null) {
      for (let i = 0; i < bots?.length; i++) {
        const bot = bots[i];
        //@ts-ignore
        const user: ApiUser = ChatMsg.buildDefaultBotUser({
          ...bot
        });
        ChatMsg.apiUpdate({
          "@type": "updateGlobalUpdate",
          data: {
            action: "updateBots",
            payload: {user}
          }
        });

      }
    }
    const topCats1: any = {};
    if (topSearchPlaceHolder) {
      topCats1.topSearchPlaceHolder = topSearchPlaceHolder;
    }
    if (cats) {
      topCats1.cats = cats;
    }

    if (time) {
      topCats1.time = time;
    }
    ChatMsg.apiUpdate({
      "@type": "updateGlobalUpdate",
      data: {
        action: "updateTopCats",
        payload: {
          topCats: topCats1
        },
      }
    });
  }

  static async handleRecvMsg(pdu: Pdu) {
    switch (pdu.getCommandId()) {
      case ActionCommands.CID_SyncRes:
        await MsgWorker.handleSyncRes(pdu);
        break;
      case ActionCommands.CID_TopCatsRes:
        await MsgWorker.handleTopCatsRes(pdu);
        break;
      case ActionCommands.CID_SendMsgRes:
        await MsgWorker.handleSendMsgRes(pdu);
        break
      case ActionCommands.CID_SendBotMsgRes:
        await MsgWorker.handleSendBotMsgRes(pdu);
        break;
    }
  }

  static async createWsBot(accountId: number, botApi?: string) {
    if (botApi && botApi.startsWith("ws")) {
      const botWs = BotWebSocket.getInstance(accountId);
      if (!botWs.isLogged()) {
        botWs.setMsgHandler(async (msgConnId, notifies) => {
          for (let i = 0; i < notifies.length; i++) {
            const {
              action,
              payload
            } = notifies[i];
            switch (action) {
              case BotWebSocketNotifyAction.onConnectionStateChanged:
                switch (payload.BotWebSocketState) {
                  case BotWebSocketState.logged:
                    ChatMsg.apiUpdate({
                      "@type": "updateGlobalUpdate",
                      data: {
                        action: "onLogged",
                      }
                    });
                    break;
                  case BotWebSocketState.connected:
                    break;
                  case BotWebSocketState.closed:
                    break;
                }
                break;
              case BotWebSocketNotifyAction.onData:
                // console.log("[onData]",{accountId},getActionCommandsName(payload.getCommandId()))
                await MsgWorker.handleRecvMsg(payload);
                break;
            }
          }
        });
        botWs.setWsUrl(botApi ? botApi : CLOUD_WS_URL);
        botWs.setSession(Account.getCurrentAccount()
          ?.getSession()!);
        if (!botWs.isConnect()) {
          botWs.connect();
        }
        if (botWs.isConnect() && !botWs.isLogged()) {
          await botWs.login();
        }
        await botWs.waitForMsgServerState(BotWebSocketState.logged);
      }
    }
  }

  static async genMessageId(isLocal?: boolean): Promise<number> {
    let msgId = isLocal ? getNextLocalMessageId() : parseInt(getNextLocalMessageId()
      .toString()) % LOCAL_MESSAGE_MIN_ID;
    if (messageIds.length > 10) {
      messageIds = messageIds.slice(messageIds.length - 10);
    }
    if (messageIds.includes(msgId)) {
      await sleep(100);
      return MsgWorker.genMessageId(isLocal);
    } else {
      messageIds.push(msgId);
      return msgId;
    }
  }

  static async genMsgId(pdu: Pdu): Promise<Uint8Array> {
    const {isLocal} = GenMsgIdReq.parseMsg(pdu);
    return new GenMsgIdRes({messageId: await MsgWorker.genMessageId(isLocal)}).pack()
      .getPbData();
  }

  static getMediaFileId(media: GramJs.TypeInputMedia | undefined) {
    let fileId;
    //@ts-ignore
    if (media && media!.file && media.file.id) {
      //@ts-ignore
      fileId = media!.file.id.toString();
    }
    return fileId;
  }

  async handleMedia() {
    const {
      msgSend,
      attachment
    } = this;
    if (attachment) {
      let fileId = MsgWorker.getMediaFileId(this.media);

      if (msgSend.content.photo || msgSend.content.document) {
        const getPhotoInfo = async (attachment: ApiAttachment) => {
          const dataUri = await blobToDataUri(await fetchBlob(attachment.thumbBlobUrl!));
          const size = {
            "width": attachment.quick!.width,
            "height": attachment.quick!.height,
          };
          return {
            dataUri,
            size
          };
        };

        if (msgSend.content.document) {
          msgSend.content.document.id = fileId;

          if (msgSend.content.document.mimeType.split("/")[0] === "image") {
            const {
              size,
              dataUri
            } = await getPhotoInfo(attachment);
            msgSend.content.document.mediaType = "photo";
            msgSend.content.document.previewBlobUrl = undefined;
            msgSend.content.document.thumbnail = {
              ...size,
              dataUri
            };
            msgSend.content.document.mediaSize = size;
          }
        }

        if (msgSend.content.photo) {
          const {
            size,
            dataUri
          } = await getPhotoInfo(attachment);
          msgSend.content.photo = {
            isSpoiler: msgSend.content.photo.isSpoiler,
            id: fileId,
            "thumbnail": {
              ...size,
              dataUri
            },
            "sizes": [
              {
                ...size,
                "type": "y"
              }
            ],
          };
        }
      }

      if (msgSend.content.voice) {
        msgSend.content.voice.id = fileId;
      }
      if (msgSend.content.audio) {
        msgSend.content.audio.id = fileId;
      }
      this.msgSend = msgSend;
    }
  }

  async processOutGoing() {
    const {msgSend} = this;
    const {enableAi} = this.botInfo?.aiBot || {};
    const msgId = await MsgWorker.genMessageId();
    let message = {
      ...msgSend,
      id: msgId,
      isOutgoing:!enableAi,
      sendingState: undefined,
    };

    ChatMsg.apiUpdate({
      '@type': "updateMessageSendSucceeded",
      chatId: msgSend.chatId,
      localId: msgSend.id,
      message,
    });
    this.msgSend = message;
    await sendWithCallback(new SendTextMsgReq({
      msg:Buffer.from(new PbMsg(message as PbMsg_Type).pack().getPbData())
    }).pack().getPbData())
  }

  async process() {
    const {
      msgSend,
      chat
    } = this;

    try {
      await this.handleMedia();
      await this.processOutGoing();
    } catch (error: any) {
      console.error(error);
      ChatMsg.apiUpdate({
        '@type': 'updateMessageSendFailed',
        chatId: chat.id,
        localId: msgSend.id,
        error: error.message,
      });
    }
  }
}
