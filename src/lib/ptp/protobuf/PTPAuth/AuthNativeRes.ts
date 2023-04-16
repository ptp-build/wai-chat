import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { AuthNativeRes_Type } from './types';

export default class AuthNativeRes extends BaseMsg {
  public msg?: AuthNativeRes_Type
  constructor(msg?: AuthNativeRes_Type) {
    super('PTP.Auth.AuthNativeRes', msg);
    this.setCommandId(ActionCommands.CID_AuthNativeRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): AuthNativeRes_Type {
    return new AuthNativeRes().decode(pdu.body());
  }
}
