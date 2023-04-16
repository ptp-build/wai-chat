import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { DownloadReq_Type } from './types';

export default class DownloadReq extends BaseMsg {
  public msg?: DownloadReq_Type
  constructor(msg?: DownloadReq_Type) {
    super('PTP.File.DownloadReq', msg);
    this.setCommandId(ActionCommands.CID_DownloadReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): DownloadReq_Type {
    return new DownloadReq().decode(pdu.body());
  }
}
