import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { UpdateProfileRes_Type } from './types';

export default class UpdateProfileRes extends BaseMsg {
  public msg?: UpdateProfileRes_Type
  constructor(msg?: UpdateProfileRes_Type) {
    super('PTP.Auth.UpdateProfileRes', msg);
    this.setCommandId(ActionCommands.CID_UpdateProfileRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): UpdateProfileRes_Type {
    return new UpdateProfileRes().decode(pdu.body());
  }
}
