import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { CallbackButtonRes_Type } from './types';

export default class CallbackButtonRes extends BaseMsg {
  public msg?: CallbackButtonRes_Type
  constructor(msg?: CallbackButtonRes_Type) {
    super('PTP.Msg.CallbackButtonRes', msg);
    this.setCommandId(ActionCommands.CID_CallbackButtonRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): CallbackButtonRes_Type {
    return new CallbackButtonRes().decode(pdu.body());
  }
}
