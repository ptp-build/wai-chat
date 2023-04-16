import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { DownloadRes_Type } from './types';

export default class DownloadRes extends BaseMsg {
  public msg?: DownloadRes_Type
  constructor(msg?: DownloadRes_Type) {
    super('PTP.File.DownloadRes', msg);
    this.setCommandId(ActionCommands.CID_DownloadRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): DownloadRes_Type {
    return new DownloadRes().decode(pdu.body());
  }
}
