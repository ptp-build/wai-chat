import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { AnswerCallbackButtonReq_Type } from './types';

export default class AnswerCallbackButtonReq extends BaseMsg {
  public msg?: AnswerCallbackButtonReq_Type
  constructor(msg?: AnswerCallbackButtonReq_Type) {
    super('PTP.Msg.AnswerCallbackButtonReq', msg);
    this.setCommandId(ActionCommands.CID_AnswerCallbackButtonReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): AnswerCallbackButtonReq_Type {
    return new AnswerCallbackButtonReq().decode(pdu.body());
  }
}
