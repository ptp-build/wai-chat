import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { SendTextMsgReq_Type } from './types';

export default class SendTextMsgReq extends BaseMsg {
  public msg?: SendTextMsgReq_Type
  constructor(msg?: SendTextMsgReq_Type) {
    super('PTP.Msg.SendTextMsgReq', msg);
    this.setCommandId(ActionCommands.CID_SendTextMsgReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): SendTextMsgReq_Type {
    return new SendTextMsgReq().decode(pdu.body());
  }
}
