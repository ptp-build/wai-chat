// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbQrCode_Type } from './types';

export default class PbQrCode extends BaseMsg {
  public msg?: PbQrCode_Type
  constructor(msg?: PbQrCode_Type) {
    super('PTP.Common.PbQrCode', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbQrCode_Type {
    return new PbQrCode().decode(pdu.body());
  }
}
