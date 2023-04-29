// DO NOT EDIT
import type * as PTPCommon from '../PTPCommon/types';

export interface SyncReq_Type {
  userStoreData?: PTPCommon.UserStoreData_Type;
}
export interface SyncRes_Type {
  userStoreData?: PTPCommon.UserStoreData_Type;
  err?: PTPCommon.ERR;
}
export interface TopCatsReq_Type {
  time: number;
}
export interface TopCatsRes_Type {
  payload?: string;
  err?: PTPCommon.ERR;
}
