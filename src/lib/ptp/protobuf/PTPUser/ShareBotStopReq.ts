import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { ShareBotStopReq_Type } from './types';

export default class ShareBotStopReq extends BaseMsg {
  public msg?: ShareBotStopReq_Type
  constructor(msg?: ShareBotStopReq_Type) {
    super('PTP.User.ShareBotStopReq', msg);
    this.setCommandId(ActionCommands.CID_ShareBotStopReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): ShareBotStopReq_Type {
    return new ShareBotStopReq().decode(pdu.body());
  }
}
