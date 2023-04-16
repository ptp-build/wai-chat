import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { GenMsgIdReq_Type } from './types';

export default class GenMsgIdReq extends BaseMsg {
  public msg?: GenMsgIdReq_Type
  constructor(msg?: GenMsgIdReq_Type) {
    super('PTP.Msg.GenMsgIdReq', msg);
    this.setCommandId(ActionCommands.CID_GenMsgIdReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): GenMsgIdReq_Type {
    return new GenMsgIdReq().decode(pdu.body());
  }
}
