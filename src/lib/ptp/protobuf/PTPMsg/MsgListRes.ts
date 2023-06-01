import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { MsgListRes_Type } from './types';

export default class MsgListRes extends BaseMsg {
  public msg?: MsgListRes_Type
  constructor(msg?: MsgListRes_Type) {
    super('PTP.Msg.MsgListRes', msg);
    this.setCommandId(ActionCommands.CID_MsgListRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): MsgListRes_Type {
    return new MsgListRes().decode(pdu.body());
  }
}
