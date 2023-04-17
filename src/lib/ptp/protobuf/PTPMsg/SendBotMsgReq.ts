import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { SendBotMsgReq_Type } from './types';

export default class SendBotMsgReq extends BaseMsg {
  public msg?: SendBotMsgReq_Type
  constructor(msg?: SendBotMsgReq_Type) {
    super('PTP.Msg.SendBotMsgReq', msg);
    this.setCommandId(ActionCommands.CID_SendBotMsgReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): SendBotMsgReq_Type {
    return new SendBotMsgReq().decode(pdu.body());
  }
}
