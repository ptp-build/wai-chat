// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbCatBot_Type } from './types';

export default class PbCatBot extends BaseMsg {
  public msg?: PbCatBot_Type
  constructor(msg?: PbCatBot_Type) {
    super('PTP.Common.PbCatBot', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbCatBot_Type {
    return new PbCatBot().decode(pdu.body());
  }
}
