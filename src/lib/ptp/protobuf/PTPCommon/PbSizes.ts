// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbSizes_Type } from './types';

export default class PbSizes extends BaseMsg {
  public msg?: PbSizes_Type
  constructor(msg?: PbSizes_Type) {
    super('PTP.Common.PbSizes', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbSizes_Type {
    return new PbSizes().decode(pdu.body());
  }
}
