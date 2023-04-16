// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbThumbnail_Type } from './types';

export default class PbThumbnail extends BaseMsg {
  public msg?: PbThumbnail_Type
  constructor(msg?: PbThumbnail_Type) {
    super('PTP.Common.PbThumbnail', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbThumbnail_Type {
    return new PbThumbnail().decode(pdu.body());
  }
}
