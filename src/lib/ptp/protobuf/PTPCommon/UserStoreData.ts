// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { UserStoreData_Type } from './types';

export default class UserStoreData extends BaseMsg {
  public msg?: UserStoreData_Type
  constructor(msg?: UserStoreData_Type) {
    super('PTP.Common.UserStoreData', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): UserStoreData_Type {
    return new UserStoreData().decode(pdu.body());
  }
}
