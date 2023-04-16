import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { UploadUserReq_Type } from './types';

export default class UploadUserReq extends BaseMsg {
  public msg?: UploadUserReq_Type
  constructor(msg?: UploadUserReq_Type) {
    super('PTP.User.UploadUserReq', msg);
    this.setCommandId(ActionCommands.CID_UploadUserReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): UploadUserReq_Type {
    return new UploadUserReq().decode(pdu.body());
  }
}
