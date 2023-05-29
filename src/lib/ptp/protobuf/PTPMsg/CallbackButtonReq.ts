import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { CallbackButtonReq_Type } from './types';

export default class CallbackButtonReq extends BaseMsg {
  public msg?: CallbackButtonReq_Type
  constructor(msg?: CallbackButtonReq_Type) {
    super('PTP.Msg.CallbackButtonReq', msg);
    this.setCommandId(ActionCommands.CID_CallbackButtonReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): CallbackButtonReq_Type {
    return new CallbackButtonReq().decode(pdu.body());
  }
}
