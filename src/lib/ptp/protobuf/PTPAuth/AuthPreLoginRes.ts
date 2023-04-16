import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { AuthPreLoginRes_Type } from './types';

export default class AuthPreLoginRes extends BaseMsg {
  public msg?: AuthPreLoginRes_Type
  constructor(msg?: AuthPreLoginRes_Type) {
    super('PTP.Auth.AuthPreLoginRes', msg);
    this.setCommandId(ActionCommands.CID_AuthPreLoginRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): AuthPreLoginRes_Type {
    return new AuthPreLoginRes().decode(pdu.body());
  }
}
