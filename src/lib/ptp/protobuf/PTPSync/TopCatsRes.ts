import BaseMsg from '../BaseMsg';
import { ActionCommands } from '../ActionCommands';
import type { Pdu } from '../BaseMsg';
import type { TopCatsRes_Type } from './types';

export default class TopCatsRes extends BaseMsg {
  public msg?: TopCatsRes_Type
  constructor(msg?: TopCatsRes_Type) {
    super('PTP.Sync.TopCatsRes', msg);
    this.setCommandId(ActionCommands.CID_TopCatsRes);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): TopCatsRes_Type {
    return new TopCatsRes().decode(pdu.body());
  }
}
