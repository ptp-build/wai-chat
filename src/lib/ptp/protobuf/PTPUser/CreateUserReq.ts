import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { CreateUserReq_Type } from './types';

export default class CreateUserReq extends BaseMsg {
  public msg?: CreateUserReq_Type
  constructor(msg?: CreateUserReq_Type) {
    super('PTP.User.CreateUserReq', msg);
    this.setCommandId(ActionCommands.CID_CreateUserReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): CreateUserReq_Type {
    return new CreateUserReq().decode(pdu.body());
  }
}
