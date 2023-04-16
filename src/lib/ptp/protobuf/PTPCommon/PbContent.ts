// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbContent_Type } from './types';

export default class PbContent extends BaseMsg {
  public msg?: PbContent_Type
  constructor(msg?: PbContent_Type) {
    super('PTP.Common.PbContent', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbContent_Type {
    return new PbContent().decode(pdu.body());
  }
}
