// DO NOT EDIT
import type * as PTPCommon from '../PTPCommon/types';

export interface DownloadUserReq_Type {
  userIds?: string[];
}
export interface DownloadUserRes_Type {
  users?: PTPCommon.UserStoreRow_Type[];
  err?: PTPCommon.ERR;
}
export interface GenUserIdReq_Type {}
export interface GenUserIdRes_Type {
  userId: number;
  err: PTPCommon.ERR;
}
export interface ShareBotReq_Type {
  userId: string;
  firstName: string;
  avatarHash?: string;
  bio: string;
  init_system_content?: string;
  welcome?: string;
  template?: string;
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
  users?: PTPCommon.UserStoreRow_Type[];
  time: number;
}
export interface UploadUserRes_Type {
  err?: PTPCommon.ERR;
}
