// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbReaction_Type } from './types';

export default class PbReaction extends BaseMsg {
  public msg?: PbReaction_Type
  constructor(msg?: PbReaction_Type) {
    super('PTP.Common.PbReaction', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbReaction_Type {
    return new PbReaction().decode(pdu.body());
  }
}
