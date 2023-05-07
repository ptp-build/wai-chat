import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { ShareBotStopRes_Type } from './types';

export default class ShareBotStopRes extends BaseMsg {
  public msg?: ShareBotStopRes_Type
  constructor(msg?: ShareBotStopRes_Type) {
    super('PTP.User.ShareBotStopRes', msg);
    this.setCommandId(ActionCommands.CID_ShareBotStopRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): ShareBotStopRes_Type {
    return new ShareBotStopRes().decode(pdu.body());
  }
}
