// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbDocument_Type } from './types';

export default class PbDocument extends BaseMsg {
  public msg?: PbDocument_Type
  constructor(msg?: PbDocument_Type) {
    super('PTP.Common.PbDocument', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbDocument_Type {
    return new PbDocument().decode(pdu.body());
  }
}
