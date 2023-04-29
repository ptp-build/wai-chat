import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { SendBotMsgRes_Type } from './types';

export default class SendBotMsgRes extends BaseMsg {
  public msg?: SendBotMsgRes_Type
  constructor(msg?: SendBotMsgRes_Type) {
    super('PTP.Msg.SendBotMsgRes', msg);
    this.setCommandId(ActionCommands.CID_SendBotMsgRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): SendBotMsgRes_Type {
    return new SendBotMsgRes().decode(pdu.body());
  }
}
