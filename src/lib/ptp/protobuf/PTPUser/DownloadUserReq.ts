import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { DownloadUserReq_Type } from './types';

export default class DownloadUserReq extends BaseMsg {
  public msg?: DownloadUserReq_Type
  constructor(msg?: DownloadUserReq_Type) {
    super('PTP.User.DownloadUserReq', msg);
    this.setCommandId(ActionCommands.CID_DownloadUserReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): DownloadUserReq_Type {
    return new DownloadUserReq().decode(pdu.body());
  }
}
