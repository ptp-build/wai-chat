import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { UploadRes_Type } from './types';

export default class UploadRes extends BaseMsg {
  public msg?: UploadRes_Type
  constructor(msg?: UploadRes_Type) {
    super('PTP.File.UploadRes', msg);
    this.setCommandId(ActionCommands.CID_UploadRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): UploadRes_Type {
    return new UploadRes().decode(pdu.body());
  }
}
