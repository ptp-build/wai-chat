import {ApiBotInfo, ApiMessage} from "../../api/types";
import {parseCodeBlock, parseEntities} from "../share/utils/stringParse";
import {getActions, getGlobal, setGlobal} from "../../global";
import {PbMsg} from "../../lib/ptp/protobuf/PTPCommon";
import {PbMsg_Type} from "../../lib/ptp/protobuf/PTPCommon/types";
import {callApiWithPdu} from "./utils";
import {UploadMsgReq, UploadMsgRes} from "../../lib/ptp/protobuf/PTPMsg";

export function handleMessageTextCode(msgSend: Partial<ApiMessage> | ApiMessage) {
  if (msgSend.content?.text && msgSend.content.text.text) {
    const {entities} = msgSend.content.text;
    // @ts-ignore
    msgSend.content.text = {
      ...parseCodeBlock(msgSend.content.text?.text, entities)
    };
  }
  return msgSend;
}

export async function uploadMsgList(chatId: string, messagesList: ApiMessage[]) {
  let global = getGlobal();
  const messages = messagesList.map(message => Buffer.from(new PbMsg(message as PbMsg_Type).pack()
    .getPbData()));
  const res = await callApiWithPdu(new UploadMsgReq({
    messages,
    chatId: chatId,
  }).pack());
  if (res && res.pdu) {
    const {userMessageStoreData} = UploadMsgRes.parseMsg(res.pdu);
    global = getGlobal();
    setGlobal({
      ...global,
      userMessageStoreData: {
        ...global.userMessageStoreData,
        [chatId]: userMessageStoreData
      }
    });
    getActions()
      .showNotification({message: "保存成功"});
  } else {
    getActions()
      .showNotification({message: "保存失败"});
  }
}

export function handleBotCmdText(msgSend: Partial<ApiMessage> | ApiMessage, botInfo: ApiBotInfo, userNames: Record<string, string> = {}) {
  const commands: string[] = [];
  if (botInfo && botInfo.commands) {
    botInfo.commands.forEach(cmd => commands.push(cmd.command));
  }
  if (msgSend.content && msgSend.content.text && msgSend.content.text.text) {
    if (msgSend.content.text!.entities && msgSend.content.text!.entities.find(e => {
      // @ts-ignore
      return e.cipher;
    })) {
    } else {
      // @ts-ignore
      msgSend.content.text!.entities = [
        ...msgSend.content.text!.entities || [],
        ...parseEntities(msgSend.content.text!.text!, commands, userNames)
      ];
    }
  }
  return msgSend;
}
