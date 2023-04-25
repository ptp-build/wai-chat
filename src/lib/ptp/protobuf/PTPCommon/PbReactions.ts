// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbReactions_Type } from './types';

export default class PbReactions extends BaseMsg {
  public msg?: PbReactions_Type
  constructor(msg?: PbReactions_Type) {
    super('PTP.Common.PbReactions', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbReactions_Type {
    return new PbReactions().decode(pdu.body());
  }
}
