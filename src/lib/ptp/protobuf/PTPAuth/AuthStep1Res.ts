import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { AuthStep1Res_Type } from './types';

export default class AuthStep1Res extends BaseMsg {
  public msg?: AuthStep1Res_Type
  constructor(msg?: AuthStep1Res_Type) {
    super('PTP.Auth.AuthStep1Res', msg);
    this.setCommandId(ActionCommands.CID_AuthStep1Res);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): AuthStep1Res_Type {
    return new AuthStep1Res().decode(pdu.body());
  }
}
