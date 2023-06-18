import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { FetchBotSettingReq_Type } from './types';

export default class FetchBotSettingReq extends BaseMsg {
  public msg?: FetchBotSettingReq_Type
  constructor(msg?: FetchBotSettingReq_Type) {
    super('PTP.User.FetchBotSettingReq', msg);
    this.setCommandId(ActionCommands.CID_FetchBotSettingReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): FetchBotSettingReq_Type {
    return new FetchBotSettingReq().decode(pdu.body());
  }
}
