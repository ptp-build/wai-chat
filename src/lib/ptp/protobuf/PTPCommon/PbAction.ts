// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbAction_Type } from './types';

export default class PbAction extends BaseMsg {
  public msg?: PbAction_Type
  constructor(msg?: PbAction_Type) {
    super('PTP.Common.PbAction', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbAction_Type {
    return new PbAction().decode(pdu.body());
  }
}
