// DO NOT EDIT
import type * as PTPCommon from '../PTPCommon/types';

export interface LoadChatsReq_Type {
  limit: number;
  offsetDate: number;
  archived: boolean;
  withPinned: boolean;
  lastLocalServiceMessage?: string;
}
export interface LoadChatsRes_Type {
  payload: string;
  err: PTPCommon.ERR;
}
