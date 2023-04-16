import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { UploadProfilePhotoRes_Type } from './types';

export default class UploadProfilePhotoRes extends BaseMsg {
  public msg?: UploadProfilePhotoRes_Type
  constructor(msg?: UploadProfilePhotoRes_Type) {
    super('PTP.Auth.UploadProfilePhotoRes', msg);
    this.setCommandId(ActionCommands.CID_UploadProfilePhotoRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): UploadProfilePhotoRes_Type {
    return new UploadProfilePhotoRes().decode(pdu.body());
  }
}
