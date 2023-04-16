import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { UpdateUsernameRes_Type } from './types';

export default class UpdateUsernameRes extends BaseMsg {
  public msg?: UpdateUsernameRes_Type
  constructor(msg?: UpdateUsernameRes_Type) {
    super('PTP.Auth.UpdateUsernameRes', msg);
    this.setCommandId(ActionCommands.CID_UpdateUsernameRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): UpdateUsernameRes_Type {
    return new UpdateUsernameRes().decode(pdu.body());
  }
}
