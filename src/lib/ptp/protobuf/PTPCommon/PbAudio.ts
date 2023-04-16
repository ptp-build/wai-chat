// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbAudio_Type } from './types';

export default class PbAudio extends BaseMsg {
  public msg?: PbAudio_Type
  constructor(msg?: PbAudio_Type) {
    super('PTP.Common.PbAudio', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbAudio_Type {
    return new PbAudio().decode(pdu.body());
  }
}
