import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { UpdateUsernameReq_Type } from './types';

export default class UpdateUsernameReq extends BaseMsg {
  public msg?: UpdateUsernameReq_Type
  constructor(msg?: UpdateUsernameReq_Type) {
    super('PTP.Auth.UpdateUsernameReq', msg);
    this.setCommandId(ActionCommands.CID_UpdateUsernameReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): UpdateUsernameReq_Type {
    return new UpdateUsernameReq().decode(pdu.body());
  }
}
