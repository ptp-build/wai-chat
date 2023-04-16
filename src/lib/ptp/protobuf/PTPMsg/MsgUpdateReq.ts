import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { MsgUpdateReq_Type } from './types';

export default class MsgUpdateReq extends BaseMsg {
  public msg?: MsgUpdateReq_Type
  constructor(msg?: MsgUpdateReq_Type) {
    super('PTP.Msg.MsgUpdateReq', msg);
    this.setCommandId(ActionCommands.CID_MsgUpdateReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): MsgUpdateReq_Type {
    return new MsgUpdateReq().decode(pdu.body());
  }
}
