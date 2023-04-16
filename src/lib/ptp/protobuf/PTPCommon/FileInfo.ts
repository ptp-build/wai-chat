// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { FileInfo_Type } from './types';

export default class FileInfo extends BaseMsg {
  public msg?: FileInfo_Type
  constructor(msg?: FileInfo_Type) {
    super('PTP.Common.FileInfo', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): FileInfo_Type {
    return new FileInfo().decode(pdu.body());
  }
}
