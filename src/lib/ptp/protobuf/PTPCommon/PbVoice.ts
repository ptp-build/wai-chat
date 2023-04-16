// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbVoice_Type } from './types';

export default class PbVoice extends BaseMsg {
  public msg?: PbVoice_Type
  constructor(msg?: PbVoice_Type) {
    super('PTP.Common.PbVoice', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbVoice_Type {
    return new PbVoice().decode(pdu.body());
  }
}
