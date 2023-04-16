import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { StopChatStreamReq_Type } from './types';

export default class StopChatStreamReq extends BaseMsg {
  public msg?: StopChatStreamReq_Type
  constructor(msg?: StopChatStreamReq_Type) {
    super('PTP.Other.StopChatStreamReq', msg);
    this.setCommandId(ActionCommands.CID_StopChatStreamReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): StopChatStreamReq_Type {
    return new StopChatStreamReq().decode(pdu.body());
  }
}
