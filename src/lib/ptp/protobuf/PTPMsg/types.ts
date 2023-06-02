// DO NOT EDIT
import type * as PTPCommon from '../PTPCommon/types';

export interface CallbackButtonReq_Type {
  chatId: string;
  data: string;
}
export interface CallbackButtonRes_Type {
  text: string;
  inlineButtons?: string;
  chatId: string;
  err?: PTPCommon.ERR;
}
export interface DownloadMsgReq_Type {
  chatId: string;
  msgIds?: number[];
}
export interface DownloadMsgRes_Type {
  chatId: string;
  msgList?: PTPCommon.PbMsg_Type[];
}
export interface GenMsgIdReq_Type {
  isLocal: boolean;
}
export interface GenMsgIdRes_Type {
  messageId: number;
  err?: PTPCommon.ERR;
}
export interface MsgListReq_Type {
  chatId: string;
  msgIds?: number[];
}
export interface MsgListRes_Type {
  chatId: string;
  msgList?: PTPCommon.MsgRow_Type[];
}
export interface RemoveMessagesReq_Type {
  messageIds?: number[];
  chatId: string;
}
export interface RemoveMessagesRes_Type {
  err: PTPCommon.ERR;
}
export interface SendBotMsgReq_Type {
  chatId?: string;
  botApi?: string;
  text?: string;
  chatGpt?: string;
  msgId?: number;
  msgDate?: number;
  msgAskId?: number;
  msgAskDate?: number;
}
export interface SendBotMsgRes_Type {
  reply?: string;
  chatId?: string;
  msgId?: number;
  streamStatus?: PTPCommon.ChatGptStreamStatus;
  message?: PTPCommon.PbMsg_Type;
}
export interface SendMsgRes_Type {
  replyText?: string;
  chatId: string;
  msgId?: number;
  senderId: string;
  date: number;
  inlineButtons?: string;
  replyToMsgId?: number;
}
export interface SendTextMsgReq_Type {
  msg: Buffer;
}
export interface UpdateCmdReq_Type {
  chatId: string;
}
export interface UpdateCmdRes_Type {
  commands?: PTPCommon.PbCommands_Type[];
  chatId?: string;
  startTips?: string;
}
export interface UploadMsgReq_Type {
  messages?: Buffer[];
  chatId: string;
}
export interface UploadMsgRes_Type {
  userMessageStoreData: PTPCommon.UserMessageStoreData_Type;
  err?: PTPCommon.ERR;
}
