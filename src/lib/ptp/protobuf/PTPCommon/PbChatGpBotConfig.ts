// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbChatGpBotConfig_Type } from './types';

export default class PbChatGpBotConfig extends BaseMsg {
  public msg?: PbChatGpBotConfig_Type
  constructor(msg?: PbChatGpBotConfig_Type) {
    super('PTP.Common.PbChatGpBotConfig', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbChatGpBotConfig_Type {
    return new PbChatGpBotConfig().decode(pdu.body());
  }
}
