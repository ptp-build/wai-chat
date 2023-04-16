import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { UploadMsgRes_Type } from './types';

export default class UploadMsgRes extends BaseMsg {
  public msg?: UploadMsgRes_Type
  constructor(msg?: UploadMsgRes_Type) {
    super('PTP.Msg.UploadMsgRes', msg);
    this.setCommandId(ActionCommands.CID_UploadMsgRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): UploadMsgRes_Type {
    return new UploadMsgRes().decode(pdu.body());
  }
}
