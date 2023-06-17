import MsgDispatcher from "./MsgDispatcher";
import {selectChatMessage, selectListedIds, selectUser} from "../../global/selectors";
import {addChats, addUsers, addUserStatuses, updateChatListIds, updateUser} from "../../global/reducers";
import {getActions, getGlobal, setGlobal} from "../../global";
import {
  ApiBotCommand,
  ApiChat,
  ApiKeyboardButton,
  ApiMessage,
  ApiUser,
  ApiUserStatus,
  MAIN_THREAD_ID
} from "../../api/types";
import {showBodyLoading} from "../share/utils/utils";
import {GlobalState} from "../../global/types";
import {ControllerPool} from "../../lib/ptp/functions/requests";
import MsgCommandChatGpt from "./MsgCommandChatGpt";
import {callApiWithPdu, sleep} from "./utils";
import {DownloadUserReq, DownloadUserRes, UploadUserReq} from "../../lib/ptp/protobuf/PTPUser";
import {CallbackButtonReq, CallbackButtonRes, DownloadMsgReq, DownloadMsgRes} from "../../lib/ptp/protobuf/PTPMsg";
import ChatMsg from "./ChatMsg";
import {createBot} from "../../global/actions/api/chats";
import {PbUser} from "../../lib/ptp/protobuf/PTPCommon";
import {Pdu} from "../../lib/ptp/protobuf/BaseMsg";
import {Decoder} from "@nuintun/qrcode";
import {handleUpdateUser} from "../../global/actions/apiUpdaters/users";
import {UserIdFirstBot} from "../setting";
import {WaiBotWorker} from "./bot/WaiBotWorker";
import {WaiBotWorkerLocal} from "./bot/WaiBotWorkerLocal";

export const encodeCallBackButtonPayload = (data:string,payload:any) => `${data}/${Buffer.from(JSON.stringify(payload))
  .toString("hex")}`;

export default class MsgCommand {
  private chatId: string;
  private chatMsg: ChatMsg;

  constructor(chatId: string) {
    this.chatId = chatId;
    this.chatMsg = new ChatMsg(this.chatId);
  }

  back(global: GlobalState, messageId: number, data: string, path: string) {
    if (path.startsWith("/")) {
      path = path.substring(1);
    }
    const btn = data.replace(`${this.chatId}/${path}/`, "");
    const inlineButtons: ApiKeyboardButton[][] = JSON.parse(btn);
    this.chatMsg.update(messageId, {
      inlineButtons
    });
  }

  static buildInlineBackButton(chatId: string, messageId: number, path: string, text: string) {
    if (path.startsWith("/")) {
      path = path.substring(1);
    }
    return MsgCommand.buildInlineCallbackButton(chatId, path + "/" + JSON.stringify(selectChatMessage(getGlobal(), chatId, messageId)!.inlineButtons), text, "callback");
  }

  static buildInlineOpenProfileBtn(chatId: string, text: string) {
    return [
      {
        type: "userProfile",
        text,
        userId: chatId
      }
    ];
  }

  static buildInlineCallbackButton(chatId: string, path: string, text: string, type: 'callback' = 'callback') {
    if (path.startsWith("/")) {
      path = path.substring(1);
    }
    return [
      {
        type,
        text,
        data: `${chatId}/${path}`
      }
    ];
  }

  static buildInlineButton(chatId: string, text: string, type: 'requestUploadImage' | 'unsupported') {
    return [
      {
        type,
        text,
      }
    ];
  }

  async clearHistory() {
    await this.chatMsg.setText("确定要清除么?")
      .setInlineButtons([
        [
          ...MsgCommand.buildInlineCallbackButton(this.chatId, "clearHistory/confirm", "确定", "callback"),
          ...MsgCommand.buildInlineCallbackButton(this.chatId, "clearHistory/cancel", "返回", "callback")
        ]
      ])
      .reply();
    return true;
  }

  reloadCommands(cmds: any[]) {
    let global = getGlobal();
    let user = selectUser(global, this.chatId);
    const botInfo = user?.fullInfo?.botInfo;
    if (botInfo) {
      //@ts-ignore
      const commands: ApiBotCommand[] = cmds.map(cmd => {
        return {
          ...cmd,
          botId: user?.id
        };
      });
      global = updateUser(global, user?.id!, {
        ...user,
        fullInfo: {
          ...user?.fullInfo,
          botInfo: {
            ...user?.fullInfo!.botInfo!,
            commands
          }
        }
      });
      setGlobal(global);
      return true;
    }
  }

  static async downloadUsers(userIds: string[]) {
    console.log("[downloadUsers]", userIds);
    for (let i = 0; i < userIds.length; i++) {
      await MsgCommand.downloadUser(userIds[i]);
    }
  }

  static async downloadUser(userId: string,isCurrentUser?:boolean) {
    let global = getGlobal();
    const userLocal = selectUser(global, userId);
    const updatedAt = userLocal?.updatedAt ? userLocal.updatedAt : 0;
    console.log("[downloadUser]", updatedAt, userId, userLocal?.firstName);
    const DownloadUserReqRes = await callApiWithPdu(new DownloadUserReq({
      userId,
      updatedAt
    }).pack());
    if (DownloadUserReqRes) {
      const downloadUserRes = DownloadUserRes.parseMsg(DownloadUserReqRes.pdu!);
      if (downloadUserRes.userBuf) {
        const user = PbUser.parseMsg(new Pdu(Buffer.from(downloadUserRes.userBuf)));
        console.log("[downloadUserRes]", user);
        const chatIds: string[] = [];
        const users: Record<string, ApiUser> = {};
        const usersStatus: Record<string, ApiUserStatus> = {};
        const chats: Record<string, ApiChat> = {};
        const userId = user.id;
        global = getGlobal();
        if(isCurrentUser){
          global = {...global,currentUserId:user!.id}
          if(selectUser(global,user!.id)){
            global = updateUser(global, user!.id, user as ApiUser);
          }else{
            global = addUsers(global, {[user!.id]: user as ApiUser});
          }
          setGlobal(global)
        }else{
          if (userLocal) {
            global = updateUser(global, user!.id, user as ApiUser);
            setGlobal(global);
          } else {
            chatIds.push(userId);
            users[userId] = user as ApiUser;
            usersStatus[userId] = {
              type: "userStatusEmpty"
            };
            chats[userId] = ChatMsg.buildDefaultChat(user as ApiUser) as ApiChat;
          }

          if (chatIds.length > 0) {
            global = updateChatListIds(global, "active", chatIds);
            global = addUsers(global, users);
            global = addUserStatuses(global, usersStatus);
            global = addChats(global, chats);
            setGlobal(global);
          }
        }

      }
    }
    await MsgCommand.downloadSavedMsg(userId);
  }

  static async uploadUser(global: GlobalState, chatId: string) {
    const user = selectUser(global, chatId);
    const userBuf = Buffer.from(new PbUser(user).pack().getPbData());

    return await callApiWithPdu(new UploadUserReq({
      userBuf,
    }).pack());
  }

  static async downloadSavedMsg(chatId: string) {
    let global = getGlobal();
    let msgIds = selectListedIds(global,chatId,MAIN_THREAD_ID) || []
    console.log("[localMsgIds]",msgIds)
    // @ts-ignore
    const DownloadMsgReqRes = await callApiWithPdu(new DownloadMsgReq({
      chatId,
      msgIds
    }).pack());
    if (DownloadMsgReqRes && DownloadMsgReqRes.pdu) {
      const {msgList} = DownloadMsgRes.parseMsg(DownloadMsgReqRes?.pdu!);
      console.log("downloadMsgRes", chatId, "msgIds",msgList);
      if (msgList) {
        for (let i = 0; i < msgList?.length; i++) {
          const msg = msgList[i];
          let global = getGlobal();
          console.log("download user",msg)
          const user = selectUser(global,chatId);
          const {senderId} = msg
          if(senderId && !selectUser(global,senderId)){
            await handleUpdateUser(global,senderId)
          }
          global = getGlobal();
          if (selectChatMessage(global, chatId, msg.id)) {
            await new ChatMsg(chatId).update(msg.id,msg as ApiMessage);
          } else {
            let isOutgoing;
            if((senderId === "1" || senderId === global.currentUserId) && !user?.fullInfo?.botInfo?.aiBot?.enableAi){
              if(user?.id !== UserIdFirstBot){
                isOutgoing = true;
              }
            }
            await new ChatMsg(chatId).sendNewMessage(msg as ApiMessage);
          }
        }
      }
    }
  }

  async copyBot(global: GlobalState, messageId: number) {
    try {
      showBodyLoading(true);
      const {chatId} = this;
      let user1 = selectUser(global, chatId);
      const user = {
        ...user1,
        id: "",
        firstName: user1?.firstName + "(复制)",
      } as ApiUser;
      MsgDispatcher.showNotification("复制成功");
      ChatMsg.apiUpdate({
        '@type': 'deleteMessages',
        ids: [messageId],
        chatId,
      });

      await createBot(global, getActions(), user);
    } catch (e) {
      console.error(e);
      MsgDispatcher.showNotification("复制失败");
    } finally {
      showBodyLoading(false);
    }
  }

  async requestUploadImage(global: GlobalState, messageId: number, files: FileList | null) {
    if (files && files.length > 0) {
      const file = files[0];
      const qrcode = new Decoder();
      const blob = new Blob([file], {type: file.type});
      const blobUrl = URL.createObjectURL(blob);
      try {
        const result = await qrcode.scan(blobUrl);
        if (result && result.data.startsWith('wai://')) {
          // await this.handleMnemonic(result.data);
        }
      } catch (e) {
      } finally {
        getActions()
          .showNotification({message: "解析二维码失败"});
      }
    }
  }

  async answerCallbackButton(global: GlobalState, messageId: number, data: string) {
    console.log("[answerCallbackButton]",data)
    const {chatId} = this;
    if (data.endsWith("/setting/cancel")) {
      const msgId1 = data.split("/")[data.split("/").length - 3];
      const cancelMessageIds = [messageId];
      if (msgId1 !== "0") {
        cancelMessageIds.push(Number(msgId1));
      }
      ChatMsg.apiUpdate({
        '@type': 'deleteMessages',
        ids: cancelMessageIds,
        chatId,
      });
    }
    await new MsgCommandChatGpt(chatId).answerCallbackButton(global, messageId, data);

    if (data.endsWith("clearHistory/confirm")) {
      let global = getGlobal();
      const chatMessages = global.messages.byChatId[chatId];
      const ids = Object.keys(chatMessages.byId)
        .map(Number);
      getActions()
        .sendBotCommand({
          chatId,
          command: "/start"
        });
      ChatMsg.apiUpdate({
        "@type": "deleteMessages",
        chatId,
        ids
      });
    }

    if (data.endsWith("clearHistory/cancel")) {
      ChatMsg.apiUpdate({
        "@type": "deleteMessages",
        chatId,
        ids: [messageId]
      });
      return;
    }

    if (data.startsWith("requestChatStream/stop/")) {
      const [chatId, messageId] = data.replace("requestChatStream/stop/", "")
        .split("/")
        .map(Number);
      ControllerPool.stop(chatId, messageId);
    }
    if (data.startsWith("requestChatStream/stop/")) {
      const [chatId, messageId] = data.replace("requestChatStream/stop/", "")
        .split("/")
        .map(Number);
      ControllerPool.stop(chatId, messageId);
    }
    if (data.startsWith("build/in/pay")) {
      await this.handleBuildInPay(chatId, data);
    }
    if (data.startsWith("server/api/")) {
      await this.handleCallbackButton(data);
    }

    if (
      data.replace(`${this.chatId}/`,"").startsWith("ipcMain/") ||
      data.replace(`${this.chatId}/`,"").startsWith("ipcRender/")) {
      await new WaiBotWorker(this.chatId,messageId).handleCallbackButton(data);
    }
    if (data.startsWith("local/") || data.startsWith(this.chatId + "/local/")){
      await new WaiBotWorkerLocal(this.chatId,messageId).handleCallbackButton(data);
    }

    if (data.startsWith(`${this.chatId}/actions/openChatId/`)){
      const chatId = data.replace(`${this.chatId}/actions/openChatId/`,"")
      getActions().openChat({id:chatId,shouldReplaceHistory:true})
    }
  }

  async handleBuildInPay(chatId: string, data: string) {
    const t = data.replace("build/in/pay/", "");
    alert(t);
  }

  async handleCallbackButton(data: string,outgoingMsgId:number = 0) {
    const {chatId} = this
    const msg = await this.chatMsg.setText("...")
      .reply();
    await sleep(500);
    let inlineButtonsList = [
      MsgCommand.buildInlineCallbackButton(chatId, `${outgoingMsgId}/setting/cancel`, "取消")
    ];
    try {
      const res = await callApiWithPdu(new CallbackButtonReq({
        chatId,
        data
      }).pack());
      if (res && res.pdu) {
        let {
          text,
          inlineButtons
        } = CallbackButtonRes.parseMsg(res.pdu);
        if (inlineButtons) {
          inlineButtonsList = [
            ...JSON.parse(inlineButtons),
            ...inlineButtonsList
          ];
        }
        if (text) {
          return await this.chatMsg.update(msg.id, {
            content: {
              text: {
                text: text!
              }
            },
            inlineButtons: inlineButtonsList
          });
        }
      }
      throw new Error("请求错误");
    } catch (e) {
      console.error(e);
      await this.chatMsg.update(msg.id, {
        content: {
          text: {
            text: "请求错误"
          }
        },
        inlineButtons: inlineButtonsList
      });
    }
  }
}
