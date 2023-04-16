// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbChatFolder_Type } from './types';

export default class PbChatFolder extends BaseMsg {
  public msg?: PbChatFolder_Type
  constructor(msg?: PbChatFolder_Type) {
    super('PTP.Common.PbChatFolder', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbChatFolder_Type {
    return new PbChatFolder().decode(pdu.body());
  }
}
