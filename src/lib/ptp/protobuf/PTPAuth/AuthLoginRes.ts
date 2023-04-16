import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { AuthLoginRes_Type } from './types';

export default class AuthLoginRes extends BaseMsg {
  public msg?: AuthLoginRes_Type
  constructor(msg?: AuthLoginRes_Type) {
    super('PTP.Auth.AuthLoginRes', msg);
    this.setCommandId(ActionCommands.CID_AuthLoginRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): AuthLoginRes_Type {
    return new AuthLoginRes().decode(pdu.body());
  }
}
