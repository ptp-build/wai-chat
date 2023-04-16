// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbUser_Type } from './types';

export default class PbUser extends BaseMsg {
  public msg?: PbUser_Type
  constructor(msg?: PbUser_Type) {
    super('PTP.Common.PbUser', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbUser_Type {
    return new PbUser().decode(pdu.body());
  }
}
