import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { AuthStep1Req_Type } from './types';

export default class AuthStep1Req extends BaseMsg {
  public msg?: AuthStep1Req_Type
  constructor(msg?: AuthStep1Req_Type) {
    super('PTP.Auth.AuthStep1Req', msg);
    this.setCommandId(ActionCommands.CID_AuthStep1Req);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): AuthStep1Req_Type {
    return new AuthStep1Req().decode(pdu.body());
  }
}
