// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbPhoto_Type } from './types';

export default class PbPhoto extends BaseMsg {
  public msg?: PbPhoto_Type
  constructor(msg?: PbPhoto_Type) {
    super('PTP.Common.PbPhoto', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbPhoto_Type {
    return new PbPhoto().decode(pdu.body());
  }
}
