import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { GenUserIdReq_Type } from './types';

export default class GenUserIdReq extends BaseMsg {
  public msg?: GenUserIdReq_Type
  constructor(msg?: GenUserIdReq_Type) {
    super('PTP.User.GenUserIdReq', msg);
    this.setCommandId(ActionCommands.CID_GenUserIdReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): GenUserIdReq_Type {
    return new GenUserIdReq().decode(pdu.body());
  }
}
