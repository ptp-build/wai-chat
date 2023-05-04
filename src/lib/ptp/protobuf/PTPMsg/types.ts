// DO NOT EDIT
import type * as PTPCommon from '../PTPCommon/types';

export interface DownloadMsgReq_Type {
  chatId: string;
}
export interface DownloadMsgRes_Type {
  messages?: PTPCommon.MessageStoreRow_Type[];
  err?: PTPCommon.ERR;
}
export interface GenMsgIdReq_Type {
  isLocal: boolean;
}
export interface GenMsgIdRes_Type {
  messageId: number;
  err?: PTPCommon.ERR;
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
}
export interface SendBotMsgRes_Type {
  reply?: string;
  chatId?: string;
  msgId?: number;
  streamStatus?: PTPCommon.ChatGptStreamStatus;
  message?: PTPCommon.PbMsg_Type;
}
export interface UpdateCmdReq_Type {
  botApi?: string;
  chatId: string;
}
export interface UpdateCmdRes_Type {
  commands?: PTPCommon.PbCommands_Type[];
  chatId?: string;
}
export interface UploadMsgReq_Type {
  messages?: PTPCommon.MessageStoreRow_Type[];
  chatId: string;
  time: number;
}
export interface UploadMsgRes_Type {
  err?: PTPCommon.ERR;
}
