// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { PbCommands_Type } from './types';

export default class PbCommands extends BaseMsg {
  public msg?: PbCommands_Type
  constructor(msg?: PbCommands_Type) {
    super('PTP.Common.PbCommands', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): PbCommands_Type {
    return new PbCommands().decode(pdu.body());
  }
}
