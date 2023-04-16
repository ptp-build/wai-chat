// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { UserMessageStoreData_Type } from './types';

export default class UserMessageStoreData extends BaseMsg {
  public msg?: UserMessageStoreData_Type
  constructor(msg?: UserMessageStoreData_Type) {
    super('PTP.Common.UserMessageStoreData', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): UserMessageStoreData_Type {
    return new UserMessageStoreData().decode(pdu.body());
  }
}
