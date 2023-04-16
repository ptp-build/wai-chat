import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { AnswerCallbackButtonRes_Type } from './types';

export default class AnswerCallbackButtonRes extends BaseMsg {
  public msg?: AnswerCallbackButtonRes_Type
  constructor(msg?: AnswerCallbackButtonRes_Type) {
    super('PTP.Msg.AnswerCallbackButtonRes', msg);
    this.setCommandId(ActionCommands.CID_AnswerCallbackButtonRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): AnswerCallbackButtonRes_Type {
    return new AnswerCallbackButtonRes().decode(pdu.body());
  }
}
