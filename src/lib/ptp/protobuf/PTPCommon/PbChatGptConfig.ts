// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbChatGptConfig_Type } from './types';

export default class PbChatGptConfig extends BaseMsg {
  public msg?: PbChatGptConfig_Type
  constructor(msg?: PbChatGptConfig_Type) {
    super('PTP.Common.PbChatGptConfig', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbChatGptConfig_Type {
    return new PbChatGptConfig().decode(pdu.body());
  }
}
