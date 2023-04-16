import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { DownloadUserRes_Type } from './types';

export default class DownloadUserRes extends BaseMsg {
  public msg?: DownloadUserRes_Type
  constructor(msg?: DownloadUserRes_Type) {
    super('PTP.User.DownloadUserRes', msg);
    this.setCommandId(ActionCommands.CID_DownloadUserRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): DownloadUserRes_Type {
    return new DownloadUserRes().decode(pdu.body());
  }
}
