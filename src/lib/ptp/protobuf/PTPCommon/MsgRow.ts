// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { MsgRow_Type } from './types';

export default class MsgRow extends BaseMsg {
  public msg?: MsgRow_Type
  constructor(msg?: MsgRow_Type) {
    super('PTP.Common.MsgRow', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): MsgRow_Type {
    return new MsgRow().decode(pdu.body());
  }
}
