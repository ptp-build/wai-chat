import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { OtherNotify_Type } from './types';

export default class OtherNotify extends BaseMsg {
  public msg?: OtherNotify_Type
  constructor(msg?: OtherNotify_Type) {
    super('PTP.Other.OtherNotify', msg);
    this.setCommandId(ActionCommands.CID_OtherNotify);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): OtherNotify_Type {
    return new OtherNotify().decode(pdu.body());
  }
}
