// DO NOT EDIT
import BaseMsg from '../BaseMsg';
import type { Pdu } from '../BaseMsg';
import type { UserAskChatGptMsg_Type } from './types';

export default class UserAskChatGptMsg extends BaseMsg {
  public msg?: UserAskChatGptMsg_Type
  constructor(msg?: UserAskChatGptMsg_Type) {
    super('PTP.Common.UserAskChatGptMsg', msg);
    this.msg = msg;
  }
  static parseMsg(pdu : Pdu): UserAskChatGptMsg_Type {
    return new UserAskChatGptMsg().decode(pdu.body());
  }
}
