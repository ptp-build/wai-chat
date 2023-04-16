// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbBotInfo_Type } from './types';

export default class PbBotInfo extends BaseMsg {
  public msg?: PbBotInfo_Type
  constructor(msg?: PbBotInfo_Type) {
    super('PTP.Common.PbBotInfo', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbBotInfo_Type {
    return new PbBotInfo().decode(pdu.body());
  }
}
