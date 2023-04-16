// DO NOT EDIT
import type * as PTPCommon from '../PTPCommon/types';

export interface AnswerCallbackButtonReq_Type {
  chatId: string;
  messageId: number;
  data?: string;
  accessHash?: string;
  isGame?: boolean;
}
export interface AnswerCallbackButtonRes_Type {
  message?: string;
  url?: string;
  alert?: string;
  err: PTPCommon.ERR;
}
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
export interface MsgDeleteReq_Type {
  user_id: string;
  chat_id: string;
  msg_ids?: number[];
  revoke?: boolean;
}
export interface MsgDeleteRes_Type {
  err: PTPCommon.ERR;
}
export interface MsgListReq_Type {
  chatId: string;
  lastMessageId: number;
  limit: number;
  isUp?: boolean;
}
export interface MsgListRes_Type {
  payload: string;
  err: PTPCommon.ERR;
}
export interface MsgUpdateReq_Type {
  user_id: string;
  chat_id: string;
  msg_id: number;
  text: string;
}
export interface MsgUpdateRes_Type {
  err: PTPCommon.ERR;
}
export interface RemoveMessagesReq_Type {
  messageIds?: number[];
}
export interface RemoveMessagesRes_Type {
  err: PTPCommon.ERR;
}
export interface SendReq_Type {
  chatId: string;
  text?: string;
  msg?: PTPCommon.PbMsg_Type;
}
export interface SendRes_Type {
  chatId: string;
  action: string;
  msg?: PTPCommon.PbMsg_Type;
  text?: string;
  localId?: number;
  err?: PTPCommon.ERR;
}
export interface UploadMsgReq_Type {
  messages?: PTPCommon.MessageStoreRow_Type[];
  chatId: string;
  time: number;
}
export interface UploadMsgRes_Type {
  err?: PTPCommon.ERR;
}
