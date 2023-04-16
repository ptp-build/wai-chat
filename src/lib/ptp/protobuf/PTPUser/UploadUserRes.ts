import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { UploadUserRes_Type } from './types';

export default class UploadUserRes extends BaseMsg {
  public msg?: UploadUserRes_Type
  constructor(msg?: UploadUserRes_Type) {
    super('PTP.User.UploadUserRes', msg);
    this.setCommandId(ActionCommands.CID_UploadUserRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): UploadUserRes_Type {
    return new UploadUserRes().decode(pdu.body());
  }
}
