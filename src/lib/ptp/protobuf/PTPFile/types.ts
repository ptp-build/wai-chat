// DO NOT EDIT
import type * as PTPCommon from '../PTPCommon/types';

export interface DownloadReq_Type {
  id: string;
  part?: number;
}
export interface DownloadRes_Type {
  file?: PTPCommon.FileInfo_Type;
  err: PTPCommon.ERR;
}
export interface UploadReq_Type {
  file: PTPCommon.FileInfo_Type;
}
export interface UploadRes_Type {
  err: PTPCommon.ERR;
}
