// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbMenuButton_Type } from './types';

export default class PbMenuButton extends BaseMsg {
  public msg?: PbMenuButton_Type
  constructor(msg?: PbMenuButton_Type) {
    super('PTP.Common.PbMenuButton', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbMenuButton_Type {
    return new PbMenuButton().decode(pdu.body());
  }
}
