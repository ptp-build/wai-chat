// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbDimensions_Type } from './types';

export default class PbDimensions extends BaseMsg {
  public msg?: PbDimensions_Type
  constructor(msg?: PbDimensions_Type) {
    super('PTP.Common.PbDimensions', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbDimensions_Type {
    return new PbDimensions().decode(pdu.body());
  }
}
