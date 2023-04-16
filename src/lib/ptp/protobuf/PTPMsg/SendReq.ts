import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { SendReq_Type } from './types';

export default class SendReq extends BaseMsg {
  public msg?: SendReq_Type
  constructor(msg?: SendReq_Type) {
    super('PTP.Msg.SendReq', msg);
    this.setCommandId(ActionCommands.CID_SendReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): SendReq_Type {
    return new SendReq().decode(pdu.body());
  }
}
