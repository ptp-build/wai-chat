import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { CreateUserRes_Type } from './types';

export default class CreateUserRes extends BaseMsg {
  public msg?: CreateUserRes_Type
  constructor(msg?: CreateUserRes_Type) {
    super('PTP.User.CreateUserRes', msg);
    this.setCommandId(ActionCommands.CID_CreateUserRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): CreateUserRes_Type {
    return new CreateUserRes().decode(pdu.body());
  }
}
