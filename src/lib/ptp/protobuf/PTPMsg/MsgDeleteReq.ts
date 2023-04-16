import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { MsgDeleteReq_Type } from './types';

export default class MsgDeleteReq extends BaseMsg {
  public msg?: MsgDeleteReq_Type
  constructor(msg?: MsgDeleteReq_Type) {
    super('PTP.Msg.MsgDeleteReq', msg);
    this.setCommandId(ActionCommands.CID_MsgDeleteReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): MsgDeleteReq_Type {
    return new MsgDeleteReq().decode(pdu.body());
  }
}
