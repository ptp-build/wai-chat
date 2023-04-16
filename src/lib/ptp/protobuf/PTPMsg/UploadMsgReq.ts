import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { UploadMsgReq_Type } from './types';

export default class UploadMsgReq extends BaseMsg {
  public msg?: UploadMsgReq_Type
  constructor(msg?: UploadMsgReq_Type) {
    super('PTP.Msg.UploadMsgReq', msg);
    this.setCommandId(ActionCommands.CID_UploadMsgReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): UploadMsgReq_Type {
    return new UploadMsgReq().decode(pdu.body());
  }
}
