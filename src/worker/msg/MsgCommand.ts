import MsgDispatcher from "./MsgDispatcher";
import {selectChatMessage, selectUser} from "../../global/selectors";
import {addChats, addUsers, addUserStatuses, updateChatListIds, updateUser} from "../../global/reducers";
import {getActions, getGlobal, setGlobal} from "../../global";
import {ApiBotCommand, ApiChat, ApiKeyboardButton, ApiMessage, ApiUser, ApiUserStatus} from "../../api/types";
import {showBodyLoading} from "../share/utils/utils";
import {GlobalState} from "../../global/types";
import MsgCommandSetting from "./MsgCommandSetting";
import {ControllerPool} from "../../lib/ptp/functions/requests";
import MsgCommandChatGpt from "./MsgCommandChatGpt";
import {callApiWithPdu, sleep} from "./utils";
import {DownloadUserReq, DownloadUserRes, UploadUserReq} from "../../lib/ptp/protobuf/PTPUser";
import {CallbackButtonReq, CallbackButtonRes, DownloadMsgReq, DownloadMsgRes} from "../../lib/ptp/protobuf/PTPMsg";
import ChatMsg from "./ChatMsg";
import {createBot} from "../../global/actions/api/chats";
import {PbMsg, PbUser} from "../../lib/ptp/protobuf/PTPCommon";
import {Pdu} from "../../lib/ptp/protobuf/BaseMsg";
import {stopOpenChat} from "../../global/actions/api/bots";

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

  reloadCommands(cmds: ApiBotCommand[]) {
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

  static async downloadUser(userId: string) {
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
        if (
          userLocal?.fullInfo && userLocal.fullInfo.botInfo && userLocal.fullInfo.botInfo.aiBot
          && userLocal.fullInfo.botInfo.aiBot.chatGptConfig && userLocal.fullInfo.botInfo.aiBot.chatGptConfig.api_key
        ) {
          user.fullInfo!.botInfo!.aiBot!.chatGptConfig!.api_key = userLocal.fullInfo.botInfo.aiBot.chatGptConfig.api_key;
        }
        if (
          userLocal?.fullInfo && userLocal.fullInfo.botInfo && userLocal.fullInfo.botInfo.aiBot
          && userLocal.fullInfo.botInfo.aiBot.commandsFromApi
        ) {
          user.fullInfo!.botInfo!.aiBot!.commandsFromApi = userLocal.fullInfo.botInfo.aiBot.commandsFromApi;
        }

        if (
          userLocal?.fullInfo && userLocal.fullInfo.botInfo && userLocal.fullInfo.botInfo.commands
        ) {
          user.fullInfo!.botInfo!.commands = userLocal.fullInfo.botInfo.commands;
        }
        console.log("[downloadUserRes]", user);
        const chatIds: string[] = [];
        const users: Record<string, ApiUser> = {};
        const usersStatus: Record<string, ApiUserStatus> = {};
        const chats: Record<string, ApiChat> = {};
        const userId = user.id;
        global = getGlobal();
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

    const gpt = new MsgCommandChatGpt(userId);
    if (gpt.getAiBotConfig("botApi")) {
      await gpt.getCmdListFromRemoteApi();
    }
    await MsgCommand.downloadSavedMsg(userId);
  }

  static async uploadUser(global: GlobalState, chatId: string) {
    const user = selectUser(global, chatId);

    if (
      user?.fullInfo && user.fullInfo.botInfo && user.fullInfo.botInfo.aiBot
      && user.fullInfo.botInfo.aiBot.chatGptConfig && user.fullInfo.botInfo.aiBot.chatGptConfig.api_key
    ) {
      user.fullInfo.botInfo.aiBot.chatGptConfig.api_key = "";
    }
    if (
      user?.fullInfo && user.fullInfo.botInfo && user.fullInfo.botInfo.aiBot
      && user.fullInfo.botInfo.aiBot.commandsFromApi
    ) {
      user.fullInfo.botInfo.aiBot.commandsFromApi = [];
    }

    if (
      user?.fullInfo && user.fullInfo.botInfo && user.fullInfo.botInfo.commands
    ) {
      user.fullInfo.botInfo.commands = [];
    }
    const userBuf = Buffer.from(new PbUser(user).pack()
      .getPbData());

    return await callApiWithPdu(new UploadUserReq({
      userBuf,
    }).pack());
  }

  static async downloadSavedMsg(chatId: string) {
    let global = getGlobal();
    // @ts-ignore
    const userMessageStoreData = global.userMessageStoreData[chatId];
    const DownloadMsgReqRes = await callApiWithPdu(new DownloadMsgReq({
      chatId,
      time: userMessageStoreData?.time || 0
    }).pack());
    if (DownloadMsgReqRes && DownloadMsgReqRes.pdu) {
      const downloadMsgRes = DownloadMsgRes.parseMsg(DownloadMsgReqRes?.pdu!);
      console.log("downloadMsgRes", chatId, downloadMsgRes);
      if (downloadMsgRes.messages) {
        for (let i = 0; i < downloadMsgRes.messages.length; i++) {
          const buf = downloadMsgRes.messages[i];
          try {
            const message = PbMsg.parseMsg(new Pdu(Buffer.from(buf)));
            if (message) {
              if (message.previousLocalId) {
                delete message.previousLocalId;
              }
              if (selectChatMessage(global, chatId, message!.id)) {
                await new ChatMsg(chatId).update(message!.id, message as ApiMessage);
              } else {
                await new ChatMsg(chatId).sendNewMessage(message as ApiMessage);
              }
            }
          } catch (e) {

          }

        }
      }
      if (downloadMsgRes.userMessageStoreData) {
        global = getGlobal();
        setGlobal({
          ...global,
          userMessageStoreData: {
            ...global.userMessageStoreData,
            [chatId]: downloadMsgRes.userMessageStoreData
          }
        });
      }
    }
  }

  async copyBot(global: GlobalState, messageId: number) {
    try {
      showBodyLoading(true);
      const {chatId} = this;
      let user = selectUser(global, chatId);
      user = {
        ...user,
        id: "",
        firstName: user?.firstName + "(复制)",
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
    await new MsgCommandSetting(this.chatId).requestUploadImage(global, messageId, files);
  }

  async answerCallbackButton(global: GlobalState, messageId: number, data: string) {
    const {chatId} = this;
    // if(data === "sign://401"){
    //   const {password} = await getPasswordFromEvent(undefined,true,"showMnemonic")
    //   if(!Account.getCurrentAccount()?.verifySession(Account.getCurrentAccount()?.getSession()!,password)){
    //     MsgDispatcher.showNotification("密码不正确")
    //     return
    //   }else{
    //     await this.chatMsg.setInlineButtons([]).setText("请将签名:```\n"+Account.getCurrentAccount()?.getSession()+"```复制给管理员").reply()
    //   }
    // }
    // if(data === chatId + "/setting/signGen"){
    //   const {password} = await getPasswordFromEvent(undefined,true,"showMnemonic")
    //   if(!Account.getCurrentAccount()?.verifySession(Account.getCurrentAccount()?.getSession()!,password)){
    //     MsgDispatcher.showNotification("密码不正确")
    //     return
    //   }else{
    //     const ts = currentTs1000();
    //     const resSign = await Account.getCurrentAccount()?.signMessage(`${ts}_${chatId}`,hashSha256(password))
    //     await this.chatMsg.setInlineButtons([]).setText( "签名:```\n"+`sk_${resSign!.sign.toString("hex")}_${ts}_${chatId}`+"```").reply()
    //   }
    // }
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
    await new MsgCommandSetting(chatId).answerCallbackButton(global, messageId, data);
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
      await this.handleCallbackButton(chatId, data);
    }
    console.log(chatId, data);
  }

  async handleBuildInPay(chatId: string, data: string) {
    const t = data.replace("build/in/pay/", "");
    alert(t);
  }

  async handleCallbackButton(chatId: string, data: string) {

    const msg = await this.chatMsg.setText("...")
      .reply();
    await sleep(500);
    let inlineButtonsList = [
      MsgCommand.buildInlineCallbackButton(this.chatId, `0/setting/cancel`, "取消")
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
