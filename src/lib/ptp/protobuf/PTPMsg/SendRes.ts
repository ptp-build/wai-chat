import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { SendRes_Type } from './types';

export default class SendRes extends BaseMsg {
  public msg?: SendRes_Type
  constructor(msg?: SendRes_Type) {
    super('PTP.Msg.SendRes', msg);
    this.setCommandId(ActionCommands.CID_SendRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): SendRes_Type {
    return new SendRes().decode(pdu.body());
  }
}
