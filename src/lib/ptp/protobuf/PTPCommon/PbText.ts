// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbText_Type } from './types';

export default class PbText extends BaseMsg {
  public msg?: PbText_Type
  constructor(msg?: PbText_Type) {
    super('PTP.Common.PbText', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbText_Type {
    return new PbText().decode(pdu.body());
  }
}
