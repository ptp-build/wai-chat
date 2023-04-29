import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { TopCatsReq_Type } from './types';

export default class TopCatsReq extends BaseMsg {
  public msg?: TopCatsReq_Type
  constructor(msg?: TopCatsReq_Type) {
    super('PTP.Sync.TopCatsReq', msg);
    this.setCommandId(ActionCommands.CID_TopCatsReq);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): TopCatsReq_Type {
    return new TopCatsReq().decode(pdu.body());
  }
}
