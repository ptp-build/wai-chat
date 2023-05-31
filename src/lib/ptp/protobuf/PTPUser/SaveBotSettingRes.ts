import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { SaveBotSettingRes_Type } from './types';

export default class SaveBotSettingRes extends BaseMsg {
  public msg?: SaveBotSettingRes_Type
  constructor(msg?: SaveBotSettingRes_Type) {
    super('PTP.User.SaveBotSettingRes', msg);
    this.setCommandId(ActionCommands.CID_SaveBotSettingRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): SaveBotSettingRes_Type {
    return new SaveBotSettingRes().decode(pdu.body());
  }
}
