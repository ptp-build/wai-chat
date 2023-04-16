import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { GenMsgIdRes_Type } from './types';

export default class GenMsgIdRes extends BaseMsg {
  public msg?: GenMsgIdRes_Type
  constructor(msg?: GenMsgIdRes_Type) {
    super('PTP.Msg.GenMsgIdRes', msg);
    this.setCommandId(ActionCommands.CID_GenMsgIdRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): GenMsgIdRes_Type {
    return new GenMsgIdRes().decode(pdu.body());
  }
}
