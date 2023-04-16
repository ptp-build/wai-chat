// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbChat_Type } from './types';

export default class PbChat extends BaseMsg {
  public msg?: PbChat_Type
  constructor(msg?: PbChat_Type) {
    super('PTP.Common.PbChat', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbChat_Type {
    return new PbChat().decode(pdu.body());
  }
}
