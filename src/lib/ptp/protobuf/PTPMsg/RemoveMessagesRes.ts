import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { RemoveMessagesRes_Type } from './types';

export default class RemoveMessagesRes extends BaseMsg {
  public msg?: RemoveMessagesRes_Type
  constructor(msg?: RemoveMessagesRes_Type) {
    super('PTP.Msg.RemoveMessagesRes', msg);
    this.setCommandId(ActionCommands.CID_RemoveMessagesRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): RemoveMessagesRes_Type {
    return new RemoveMessagesRes().decode(pdu.body());
  }
}
