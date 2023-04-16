// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbSettings_Type } from './types';

export default class PbSettings extends BaseMsg {
  public msg?: PbSettings_Type
  constructor(msg?: PbSettings_Type) {
    super('PTP.Common.PbSettings', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbSettings_Type {
    return new PbSettings().decode(pdu.body());
  }
}
