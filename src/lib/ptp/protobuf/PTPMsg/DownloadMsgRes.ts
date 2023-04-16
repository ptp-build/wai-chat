import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { DownloadMsgRes_Type } from './types';

export default class DownloadMsgRes extends BaseMsg {
  public msg?: DownloadMsgRes_Type
  constructor(msg?: DownloadMsgRes_Type) {
    super('PTP.Msg.DownloadMsgRes', msg);
    this.setCommandId(ActionCommands.CID_DownloadMsgRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): DownloadMsgRes_Type {
    return new DownloadMsgRes().decode(pdu.body());
  }
}
