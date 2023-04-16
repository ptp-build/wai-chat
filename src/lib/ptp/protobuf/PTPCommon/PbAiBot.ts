// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbAiBot_Type } from './types';

export default class PbAiBot extends BaseMsg {
  public msg?: PbAiBot_Type
  constructor(msg?: PbAiBot_Type) {
    super('PTP.Common.PbAiBot', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbAiBot_Type {
    return new PbAiBot().decode(pdu.body());
  }
}
