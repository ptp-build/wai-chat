// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { MessageStoreRow_Type } from './types';

export default class MessageStoreRow extends BaseMsg {
  public msg?: MessageStoreRow_Type
  constructor(msg?: MessageStoreRow_Type) {
    super('PTP.Common.MessageStoreRow', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): MessageStoreRow_Type {
    return new MessageStoreRow().decode(pdu.body());
  }
}
