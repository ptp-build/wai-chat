import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { MsgUpdateRes_Type } from './types';

export default class MsgUpdateRes extends BaseMsg {
  public msg?: MsgUpdateRes_Type
  constructor(msg?: MsgUpdateRes_Type) {
    super('PTP.Msg.MsgUpdateRes', msg);
    this.setCommandId(ActionCommands.CID_MsgUpdateRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): MsgUpdateRes_Type {
    return new MsgUpdateRes().decode(pdu.body());
  }
}
