// DO NOT EDIT
import type * as PTPCommon from '../PTPCommon/types';

export interface CreateUserReq_Type {
  username: string;
}
export interface CreateUserRes_Type {}
export interface DownloadUserReq_Type {
  userId: string;
  updatedAt?: number;
}
export interface DownloadUserRes_Type {
  userBuf?: Buffer;
  err?: PTPCommon.ERR;
}
export interface FetchBotSettingReq_Type {
  key: string;
}
export interface FetchBotSettingRes_Type {
  key: string;
  value: string;
}
export interface GenUserIdReq_Type {
  username?: string;
}
export interface GenUserIdRes_Type {
  userId?: number;
  err: PTPCommon.ERR;
}
export interface SaveBotSettingReq_Type {
  key: string;
  value: string;
}
export interface SaveBotSettingRes_Type {
  err?: PTPCommon.ERR;
}
export interface ShareBotReq_Type {
  catTitle: string;
  catBot: PTPCommon.PbCatBot_Type;
}
export interface ShareBotRes_Type {
  err?: PTPCommon.ERR;
}
export interface ShareBotStopReq_Type {
  userId: string;
}
export interface ShareBotStopRes_Type {
  err?: PTPCommon.ERR;
}
export interface UploadUserReq_Type {
  userBuf: Buffer;
}
export interface UploadUserRes_Type {
  err?: PTPCommon.ERR;
}
