// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbUsernames_Type } from './types';

export default class PbUsernames extends BaseMsg {
  public msg?: PbUsernames_Type
  constructor(msg?: PbUsernames_Type) {
    super('PTP.Common.PbUsernames', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbUsernames_Type {
    return new PbUsernames().decode(pdu.body());
  }
}
