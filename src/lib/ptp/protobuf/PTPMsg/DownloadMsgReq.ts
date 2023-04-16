import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { DownloadMsgReq_Type } from './types';

export default class DownloadMsgReq extends BaseMsg {
  public msg?: DownloadMsgReq_Type
  constructor(msg?: DownloadMsgReq_Type) {
    super('PTP.Msg.DownloadMsgReq', msg);
    this.setCommandId(ActionCommands.CID_DownloadMsgReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): DownloadMsgReq_Type {
    return new DownloadMsgReq().decode(pdu.body());
  }
}
