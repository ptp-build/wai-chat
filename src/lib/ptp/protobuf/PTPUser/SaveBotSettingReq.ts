import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { SaveBotSettingReq_Type } from './types';

export default class SaveBotSettingReq extends BaseMsg {
  public msg?: SaveBotSettingReq_Type
  constructor(msg?: SaveBotSettingReq_Type) {
    super('PTP.User.SaveBotSettingReq', msg);
    this.setCommandId(ActionCommands.CID_SaveBotSettingReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): SaveBotSettingReq_Type {
    return new SaveBotSettingReq().decode(pdu.body());
  }
}
