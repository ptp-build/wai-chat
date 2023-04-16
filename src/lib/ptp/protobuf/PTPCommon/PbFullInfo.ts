// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbFullInfo_Type } from './types';

export default class PbFullInfo extends BaseMsg {
  public msg?: PbFullInfo_Type
  constructor(msg?: PbFullInfo_Type) {
    super('PTP.Common.PbFullInfo', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbFullInfo_Type {
    return new PbFullInfo().decode(pdu.body());
  }
}
