import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { UpdateProfileReq_Type } from './types';

export default class UpdateProfileReq extends BaseMsg {
  public msg?: UpdateProfileReq_Type
  constructor(msg?: UpdateProfileReq_Type) {
    super('PTP.Auth.UpdateProfileReq', msg);
    this.setCommandId(ActionCommands.CID_UpdateProfileReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): UpdateProfileReq_Type {
    return new UpdateProfileReq().decode(pdu.body());
  }
}
