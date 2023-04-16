import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { SyncReq_Type } from './types';

export default class SyncReq extends BaseMsg {
  public msg?: SyncReq_Type
  constructor(msg?: SyncReq_Type) {
    super('PTP.Sync.SyncReq', msg);
    this.setCommandId(ActionCommands.CID_SyncReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): SyncReq_Type {
    return new SyncReq().decode(pdu.body());
  }
}
