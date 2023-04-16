import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { GenUserIdRes_Type } from './types';

export default class GenUserIdRes extends BaseMsg {
  public msg?: GenUserIdRes_Type
  constructor(msg?: GenUserIdRes_Type) {
    super('PTP.User.GenUserIdRes', msg);
    this.setCommandId(ActionCommands.CID_GenUserIdRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): GenUserIdRes_Type {
    return new GenUserIdRes().decode(pdu.body());
  }
}
