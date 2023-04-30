import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { ShareBotReq_Type } from './types';

export default class ShareBotReq extends BaseMsg {
  public msg?: ShareBotReq_Type
  constructor(msg?: ShareBotReq_Type) {
    super('PTP.User.ShareBotReq', msg);
    this.setCommandId(ActionCommands.CID_ShareBotReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): ShareBotReq_Type {
    return new ShareBotReq().decode(pdu.body());
  }
}
