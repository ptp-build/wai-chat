// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbMsg_Type } from './types';

export default class PbMsg extends BaseMsg {
  public msg?: PbMsg_Type
  constructor(msg?: PbMsg_Type) {
    super('PTP.Common.PbMsg', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbMsg_Type {
    return new PbMsg().decode(pdu.body());
  }
}
