// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbRepliesThreadInfo_Type } from './types';

export default class PbRepliesThreadInfo extends BaseMsg {
  public msg?: PbRepliesThreadInfo_Type
  constructor(msg?: PbRepliesThreadInfo_Type) {
    super('PTP.Common.PbRepliesThreadInfo', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbRepliesThreadInfo_Type {
    return new PbRepliesThreadInfo().decode(pdu.body());
  }
}
