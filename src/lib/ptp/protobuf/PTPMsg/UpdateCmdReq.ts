import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { UpdateCmdReq_Type } from './types';

export default class UpdateCmdReq extends BaseMsg {
  public msg?: UpdateCmdReq_Type
  constructor(msg?: UpdateCmdReq_Type) {
    super('PTP.Msg.UpdateCmdReq', msg);
    this.setCommandId(ActionCommands.CID_UpdateCmdReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): UpdateCmdReq_Type {
    return new UpdateCmdReq().decode(pdu.body());
  }
}
