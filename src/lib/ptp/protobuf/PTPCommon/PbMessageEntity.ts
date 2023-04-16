// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbMessageEntity_Type } from './types';

export default class PbMessageEntity extends BaseMsg {
  public msg?: PbMessageEntity_Type
  constructor(msg?: PbMessageEntity_Type) {
    super('PTP.Common.PbMessageEntity', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbMessageEntity_Type {
    return new PbMessageEntity().decode(pdu.body());
  }
}
