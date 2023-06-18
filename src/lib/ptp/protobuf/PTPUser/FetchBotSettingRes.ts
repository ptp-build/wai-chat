import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { FetchBotSettingRes_Type } from './types';

export default class FetchBotSettingRes extends BaseMsg {
  public msg?: FetchBotSettingRes_Type
  constructor(msg?: FetchBotSettingRes_Type) {
    super('PTP.User.FetchBotSettingRes', msg);
    this.setCommandId(ActionCommands.CID_FetchBotSettingRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): FetchBotSettingRes_Type {
    return new FetchBotSettingRes().decode(pdu.body());
  }
}
