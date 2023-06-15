import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { MsgReq_Type } from './types';

export default class MsgReq extends BaseMsg {
  public msg?: MsgReq_Type
  constructor(msg?: MsgReq_Type) {
    super('PTP.Msg.MsgReq', msg);
    this.setCommandId(ActionCommands.CID_MsgReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): MsgReq_Type {
    return new MsgReq().decode(pdu.body());
  }
}
