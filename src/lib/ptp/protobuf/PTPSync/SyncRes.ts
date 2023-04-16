import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { SyncRes_Type } from './types';

export default class SyncRes extends BaseMsg {
  public msg?: SyncRes_Type
  constructor(msg?: SyncRes_Type) {
    super('PTP.Sync.SyncRes', msg);
    this.setCommandId(ActionCommands.CID_SyncRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): SyncRes_Type {
    return new SyncRes().decode(pdu.body());
  }
}
