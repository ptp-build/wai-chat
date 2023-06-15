import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { MsgRes_Type } from './types';

export default class MsgRes extends BaseMsg {
  public msg?: MsgRes_Type
  constructor(msg?: MsgRes_Type) {
    super('PTP.Msg.MsgRes', msg);
    this.setCommandId(ActionCommands.CID_MsgRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): MsgRes_Type {
    return new MsgRes().decode(pdu.body());
  }
}
