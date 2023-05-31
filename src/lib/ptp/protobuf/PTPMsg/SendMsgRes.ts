import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { SendMsgRes_Type } from './types';

export default class SendMsgRes extends BaseMsg {
  public msg?: SendMsgRes_Type
  constructor(msg?: SendMsgRes_Type) {
    super('PTP.Msg.SendMsgRes', msg);
    this.setCommandId(ActionCommands.CID_SendMsgRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): SendMsgRes_Type {
    return new SendMsgRes().decode(pdu.body());
  }
}
