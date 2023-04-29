// DO NOT EDIT
import type * as PTPCommon from '../PTPCommon/types';

export interface AuthLoginReq_Type {
  sign: string;
  clientInfo?: PTPCommon.ClientInfo_Type;
}
export interface AuthLoginRes_Type {
  err?: PTPCommon.ERR;
}
export interface AuthNativeReq_Type {
  accountId: number;
  entropy: string;
  session?: string;
}
export interface AuthNativeRes_Type {}
export interface AuthPreLoginReq_Type {
  sign1: Buffer;
  address1: string;
  sign2: Buffer;
  address2: string;
  ts: number;
}
export interface AuthPreLoginRes_Type {
  uid: string;
  ts: number;
  err: PTPCommon.ERR;
}
export interface AuthStep1Req_Type {
  p: Buffer;
}
export interface AuthStep1Res_Type {
  q: Buffer;
  address: string;
  sign: Buffer;
  ts: number;
  err: PTPCommon.ERR;
}
export interface AuthStep2Req_Type {
  ts: number;
  address: string;
  sign: Buffer;
}
export interface AuthStep2Res_Type {
  err: PTPCommon.ERR;
}
export interface InitAppRes_Type {
  chats?: string;
  messages?: string;
  chatFolders?: string;
  users?: string;
  topCats?: string;
  err?: PTPCommon.ERR;
}
export interface UpdateProfileReq_Type {
  firstName?: string;
  lastName?: string;
  about?: string;
}
export interface UpdateProfileRes_Type {
  err: PTPCommon.ERR;
}
export interface UpdateUsernameReq_Type {
  username: string;
}
export interface UpdateUsernameRes_Type {
  err: PTPCommon.ERR;
}
export interface UploadProfilePhotoReq_Type {
  id: string;
  is_video: boolean;
  thumbnail: string;
}
export interface UploadProfilePhotoRes_Type {
  payload?: string;
  err: PTPCommon.ERR;
}
