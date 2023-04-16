import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { MsgDeleteRes_Type } from './types';

export default class MsgDeleteRes extends BaseMsg {
  public msg?: MsgDeleteRes_Type
  constructor(msg?: MsgDeleteRes_Type) {
    super('PTP.Msg.MsgDeleteRes', msg);
    this.setCommandId(ActionCommands.CID_MsgDeleteRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): MsgDeleteRes_Type {
    return new MsgDeleteRes().decode(pdu.body());
  }
}
