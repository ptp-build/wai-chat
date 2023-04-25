import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { InitAppRes_Type } from './types';

export default class InitAppRes extends BaseMsg {
  public msg?: InitAppRes_Type
  constructor(msg?: InitAppRes_Type) {
    super('PTP.Auth.InitAppRes', msg);
    this.setCommandId(ActionCommands.CID_InitAppRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): InitAppRes_Type {
    return new InitAppRes().decode(pdu.body());
  }
}
