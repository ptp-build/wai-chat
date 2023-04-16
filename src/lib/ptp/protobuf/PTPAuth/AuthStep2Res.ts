import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { AuthStep2Res_Type } from './types';

export default class AuthStep2Res extends BaseMsg {
  public msg?: AuthStep2Res_Type
  constructor(msg?: AuthStep2Res_Type) {
    super('PTP.Auth.AuthStep2Res', msg);
    this.setCommandId(ActionCommands.CID_AuthStep2Res);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): AuthStep2Res_Type {
    return new AuthStep2Res().decode(pdu.body());
  }
}
