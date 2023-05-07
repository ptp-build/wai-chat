// DO NOT EDIT
import type * as PTPCommon from '../PTPCommon/types';

export interface DownloadUserReq_Type {
  userId: string;
  updatedAt?: number;
}
export interface DownloadUserRes_Type {
  userBuf?: Buffer;
  err?: PTPCommon.ERR;
}
export interface GenUserIdReq_Type {}
export interface GenUserIdRes_Type {
  userId: number;
  err: PTPCommon.ERR;
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
