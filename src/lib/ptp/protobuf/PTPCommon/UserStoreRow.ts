// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { UserStoreRow_Type } from './types';

export default class UserStoreRow extends BaseMsg {
  public msg?: UserStoreRow_Type
  constructor(msg?: UserStoreRow_Type) {
    super('PTP.Common.UserStoreRow', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): UserStoreRow_Type {
    return new UserStoreRow().decode(pdu.body());
  }
}
