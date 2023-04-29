// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbReactionCount_Type } from './types';

export default class PbReactionCount extends BaseMsg {
  public msg?: PbReactionCount_Type
  constructor(msg?: PbReactionCount_Type) {
    super('PTP.Common.PbReactionCount', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbReactionCount_Type {
    return new PbReactionCount().decode(pdu.body());
  }
}
