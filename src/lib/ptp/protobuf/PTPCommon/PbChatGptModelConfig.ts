// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbChatGptModelConfig_Type } from './types';

export default class PbChatGptModelConfig extends BaseMsg {
  public msg?: PbChatGptModelConfig_Type
  constructor(msg?: PbChatGptModelConfig_Type) {
    super('PTP.Common.PbChatGptModelConfig', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbChatGptModelConfig_Type {
    return new PbChatGptModelConfig().decode(pdu.body());
  }
}
