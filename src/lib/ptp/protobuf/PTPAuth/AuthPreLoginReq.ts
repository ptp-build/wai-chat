import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { AuthPreLoginReq_Type } from './types';

export default class AuthPreLoginReq extends BaseMsg {
  public msg?: AuthPreLoginReq_Type
  constructor(msg?: AuthPreLoginReq_Type) {
    super('PTP.Auth.AuthPreLoginReq', msg);
    this.setCommandId(ActionCommands.CID_AuthPreLoginReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): AuthPreLoginReq_Type {
    return new AuthPreLoginReq().decode(pdu.body());
  }
}
