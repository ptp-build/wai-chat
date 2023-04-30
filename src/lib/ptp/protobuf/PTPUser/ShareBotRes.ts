import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { ShareBotRes_Type } from './types';

export default class ShareBotRes extends BaseMsg {
  public msg?: ShareBotRes_Type
  constructor(msg?: ShareBotRes_Type) {
    super('PTP.User.ShareBotRes', msg);
    this.setCommandId(ActionCommands.CID_ShareBotRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): ShareBotRes_Type {
    return new ShareBotRes().decode(pdu.body());
  }
}
