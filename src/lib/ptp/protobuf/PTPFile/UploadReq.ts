import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { UploadReq_Type } from './types';

export default class UploadReq extends BaseMsg {
  public msg?: UploadReq_Type
  constructor(msg?: UploadReq_Type) {
    super('PTP.File.UploadReq', msg);
    this.setCommandId(ActionCommands.CID_UploadReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): UploadReq_Type {
    return new UploadReq().decode(pdu.body());
  }
}
