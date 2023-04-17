import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { UpdateCmdRes_Type } from './types';

export default class UpdateCmdRes extends BaseMsg {
  public msg?: UpdateCmdRes_Type
  constructor(msg?: UpdateCmdRes_Type) {
    super('PTP.Msg.UpdateCmdRes', msg);
    this.setCommandId(ActionCommands.CID_UpdateCmdRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): UpdateCmdRes_Type {
    return new UpdateCmdRes().decode(pdu.body());
  }
}
