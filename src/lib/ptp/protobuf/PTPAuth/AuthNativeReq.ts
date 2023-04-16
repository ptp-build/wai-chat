import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { AuthNativeReq_Type } from './types';

export default class AuthNativeReq extends BaseMsg {
  public msg?: AuthNativeReq_Type
  constructor(msg?: AuthNativeReq_Type) {
    super('PTP.Auth.AuthNativeReq', msg);
    this.setCommandId(ActionCommands.CID_AuthNativeReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): AuthNativeReq_Type {
    return new AuthNativeReq().decode(pdu.body());
  }
}
