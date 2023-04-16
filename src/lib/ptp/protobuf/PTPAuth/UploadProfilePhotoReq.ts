import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { UploadProfilePhotoReq_Type } from './types';

export default class UploadProfilePhotoReq extends BaseMsg {
  public msg?: UploadProfilePhotoReq_Type
  constructor(msg?: UploadProfilePhotoReq_Type) {
    super('PTP.Auth.UploadProfilePhotoReq', msg);
    this.setCommandId(ActionCommands.CID_UploadProfilePhotoReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): UploadProfilePhotoReq_Type {
    return new UploadProfilePhotoReq().decode(pdu.body());
  }
}
