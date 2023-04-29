// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { ClientInfo_Type } from './types';

export default class ClientInfo extends BaseMsg {
  public msg?: ClientInfo_Type
  constructor(msg?: ClientInfo_Type) {
    super('PTP.Common.ClientInfo', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): ClientInfo_Type {
    return new ClientInfo().decode(pdu.body());
  }
}
