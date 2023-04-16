import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { RemoveMessagesReq_Type } from './types';

export default class RemoveMessagesReq extends BaseMsg {
  public msg?: RemoveMessagesReq_Type
  constructor(msg?: RemoveMessagesReq_Type) {
    super('PTP.Msg.RemoveMessagesReq', msg);
    this.setCommandId(ActionCommands.CID_RemoveMessagesReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): RemoveMessagesReq_Type {
    return new RemoveMessagesReq().decode(pdu.body());
  }
}
