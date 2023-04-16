import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { LoadChatsReq_Type } from './types';

export default class LoadChatsReq extends BaseMsg {
  public msg?: LoadChatsReq_Type
  constructor(msg?: LoadChatsReq_Type) {
    super('PTP.Chats.LoadChatsReq', msg);
    this.setCommandId(ActionCommands.CID_LoadChatsReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): LoadChatsReq_Type {
    return new LoadChatsReq().decode(pdu.body());
  }
}
