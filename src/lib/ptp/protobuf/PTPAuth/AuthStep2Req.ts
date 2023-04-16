import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { AuthStep2Req_Type } from './types';

export default class AuthStep2Req extends BaseMsg {
  public msg?: AuthStep2Req_Type
  constructor(msg?: AuthStep2Req_Type) {
    super('PTP.Auth.AuthStep2Req', msg);
    this.setCommandId(ActionCommands.CID_AuthStep2Req);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): AuthStep2Req_Type {
    return new AuthStep2Req().decode(pdu.body());
  }
}
