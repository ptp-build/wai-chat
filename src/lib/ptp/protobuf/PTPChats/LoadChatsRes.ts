import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { LoadChatsRes_Type } from './types';

export default class LoadChatsRes extends BaseMsg {
  public msg?: LoadChatsRes_Type
  constructor(msg?: LoadChatsRes_Type) {
    super('PTP.Chats.LoadChatsRes', msg);
    this.setCommandId(ActionCommands.CID_LoadChatsRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): LoadChatsRes_Type {
    return new LoadChatsRes().decode(pdu.body());
  }
}
