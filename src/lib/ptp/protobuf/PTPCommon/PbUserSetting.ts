// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbUserSetting_Type } from './types';

export default class PbUserSetting extends BaseMsg {
  public msg?: PbUserSetting_Type
  constructor(msg?: PbUserSetting_Type) {
    super('PTP.Common.PbUserSetting', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbUserSetting_Type {
    return new PbUserSetting().decode(pdu.body());
  }
}
