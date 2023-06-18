import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { MsgListReq_Type } from './types';

export default class MsgListReq extends BaseMsg {
  public msg?: MsgListReq_Type
  constructor(msg?: MsgListReq_Type) {
    super('PTP.Msg.MsgListReq', msg);
    this.setCommandId(ActionCommands.CID_MsgListReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): MsgListReq_Type {
    return new MsgListReq().decode(pdu.body());
  }
}
