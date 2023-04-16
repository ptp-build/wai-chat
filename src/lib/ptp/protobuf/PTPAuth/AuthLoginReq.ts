import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { AuthLoginReq_Type } from './types';

export default class AuthLoginReq extends BaseMsg {
  public msg?: AuthLoginReq_Type
  constructor(msg?: AuthLoginReq_Type) {
    super('PTP.Auth.AuthLoginReq', msg);
    this.setCommandId(ActionCommands.CID_AuthLoginReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): AuthLoginReq_Type {
    return new AuthLoginReq().decode(pdu.body());
  }
}
