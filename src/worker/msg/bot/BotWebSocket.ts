import {DEBUG} from '../../../config';
import {Pdu} from "../../../lib/ptp/protobuf/BaseMsg";
import {getActionCommandsName} from "../../../lib/ptp/protobuf/ActionCommands";
import Account from '../../share/Account';
import {AuthLoginReq} from "../../../lib/ptp/protobuf/PTPAuth";

export enum BotWebSocketNotifyAction {
  onConnectionStateChanged,
  onData,
}

export type BotWebSocketNotify = {
  action: BotWebSocketNotifyAction;
  payload: any;
};

export enum BotWebSocketState {
  connect_none,
  closed,
  connect_error,
  connecting,
  connected,
  logged,
}

export type MsgHandleType = (msgConnId: number, notifies: BotWebSocketNotify[]) => void

let reconnect_cnt = 0;
let seq_num = 10;
let clients: Record<string, BotWebSocket> = {};

let currentMsgConn: BotWebSocket | null = null;

export default class BotWebSocket {
  private autoConnect: boolean;
  public client: WebSocket | any | undefined;
  private __rev_msg_map: Record<number, Pdu>;
  private __sending_msg_map: Record<number, boolean>;
  private __msgHandler?: MsgHandleType;
  private sendMsgTimer?: NodeJS.Timeout;
  private state: BotWebSocketState;
  private msgConnId: number;
  private wsUrl?: string;
  private session?: string;

  constructor(msgConnId: number) {
    currentMsgConn = this;
    this.msgConnId = msgConnId;
    this.autoConnect = true;
    this.sendMsgTimer = undefined;
    this.state = BotWebSocketState.connect_none;
    this.__rev_msg_map = {};
    this.__sending_msg_map = {};
  }

  setWsUrl(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  setSession(session: string) {
    this.session = session;
  }

  getState() {
    return this.state;
  }

  getMsgConnId() {
    return this.msgConnId;
  }

  getAutoConnect() {
    return this.autoConnect;
  }

  setAutoConnect(autoConnect: boolean) {
    this.autoConnect = autoConnect;
  }

  async close() {
    this.notifyState(BotWebSocketState.closed);
    if (this.client && this.isConnect()) {
      this.client.close();
    }
  }

  connect() {
    if (!this.wsUrl) {
      console.error('no ws url');
      return;
    }
    if (
      this.state === BotWebSocketState.logged ||
      this.state === BotWebSocketState.connecting ||
      this.state === BotWebSocketState.connected
    ) {
      return;
    }
    try {
      console.log('connecting', this.msgConnId, this.wsUrl);
      this.notifyState(BotWebSocketState.connecting);
      this.client = new WebSocket(`${this.wsUrl}`);
      this.client.binaryType = 'arraybuffer';
      this.client.onopen = this.onConnected.bind(this);
      this.client.onmessage = this.onData.bind(this);
      this.client.onclose = this.onClose.bind(this);
    } catch (e) {
      console.error('connect error', e);
      this.reconnect(this.getAutoConnect());
    }
  }

  waitForMsgServerState(
    state: BotWebSocketState,
    timeout: number = 10000,
    startTime: number = 0
  ) {
    const timeout_ = 500;
    return new Promise<boolean>((resolve) => {
      setTimeout(() => {
        if (this.getState() === state) {
          resolve(true);
        } else if (timeout > 0 && startTime >= timeout) {
          //console.debug('waitForMsgServerState timeout', startTime, timeout);
          resolve(false);
        } else {
          startTime += timeout_;
          // eslint-disable-next-line promise/catch-or-return
          this.waitForMsgServerState(state, timeout, startTime)
            .then(resolve);
        }
      }, timeout_);
    });
  }

  waitTime(timeout: number = 1000, startTime: number = 0) {
    const timeout_ = 1000;
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        if (startTime >= timeout) {
          resolve();
        } else {
          startTime += timeout_;
          // eslint-disable-next-line promise/catch-or-return
          this.waitTime(timeout, startTime)
            .then(resolve);
        }
      }, timeout_);
    });
  }

  setMsgHandler(msgHandler: MsgHandleType) {
    this.__msgHandler = msgHandler;
  }

  onConnected() {
    reconnect_cnt = 0;
    console.log("[onConnected account]", this.getMsgConnId());
    this.notifyState(BotWebSocketState.connected);
    this.login()
      .catch(console.error);
  }

  async login() {
    await this.sendPduWithCallback(new AuthLoginReq({
      clientInfo: Account.getCurrentAccount()!.getClientInfo(),
      sign: Account.getCurrentAccount()
        ?.getSession()!
    }).pack());
    console.log("[onLogin] ok");
    this.notifyState(BotWebSocketState.logged);
  }

  notify(notifyList: BotWebSocketNotify[]) {
    if (this.__msgHandler) {
      this.__msgHandler(this.msgConnId, notifyList);
    }
  }

  onData(e: { data: Buffer }) {
    if (e.data && e.data.byteLength && e.data.byteLength > 16) {
      let pdu = new Pdu(Buffer.from(e.data));
      const seq_num = pdu.getSeqNum();
      if (pdu.getCommandId() === 5001) {
        console.log("[heartbeat]")
        return;
      }
      if (DEBUG) {
        console.log("[onData]", seq_num, pdu.getCommandId(), getActionCommandsName(pdu.getCommandId()));
      }
      if (this.__sending_msg_map[seq_num]) {
        this.__rev_msg_map[seq_num] = pdu;
        delete this.__sending_msg_map[seq_num];
      } else {
        if (this.__msgHandler) {
          this.notify([
            {
              action: BotWebSocketNotifyAction.onData,
              payload: pdu,
            },
          ]);
        }
      }
    }

  }

  notifyState(state: BotWebSocketState) {
    this.state = state;
    this.notify([
      {
        action: BotWebSocketNotifyAction.onConnectionStateChanged,
        payload: {
          BotWebSocketState: state,
        },
      },
    ]);
  }

  onClose() {
    if (this.sendMsgTimer) {
      clearTimeout(this.sendMsgTimer);
    }
    console.log('onClose', this.autoConnect);
    this.notifyState(BotWebSocketState.closed);
    this.reconnect(this.getAutoConnect());
  }

  reconnect(autoConnect: boolean) {
    if (autoConnect) {
      setTimeout(() => {
        if (
          this.state === BotWebSocketState.closed ||
          this.state === BotWebSocketState.connect_error
        ) {
          if (reconnect_cnt > 20) {
            reconnect_cnt = 0;
          }
          if (reconnect_cnt < 5) {
            reconnect_cnt += 1;
          } else {
            reconnect_cnt += 2;
          }
          console.log("[reconnect_cnt]", reconnect_cnt);
          this.connect();
        }
      }, 1000 * (reconnect_cnt + 1));
    }
  }

  static getInstance(msgConnId: number): BotWebSocket {
    if (!clients[msgConnId]) {
      clients[msgConnId] = new BotWebSocket(msgConnId);
    }
    return clients[msgConnId];
  }

  waitForMsgCallback(
    seq_num: number,
    timeout: number = 5000,
    startTime: number = 0
  ) {
    return new Promise<Pdu>((resolve, reject) => {
      setTimeout(() => {
        if (this.__rev_msg_map[seq_num]) {
          const res = this.__rev_msg_map[seq_num];
          delete this.__rev_msg_map[seq_num];
          resolve(res);
        } else {
          if (startTime >= timeout) {
            reject('TIMEOUT');
          } else {
            startTime += 200;
            if (this.isConnect()) {
              this.waitForMsgCallback(seq_num, timeout, startTime)
                .then(resolve)
                .catch(reject);
            }
          }
        }
      }, 200);
    });
  }

  send(data: Buffer | Uint8Array) {
    this.client.send(data);
  }

  sendPduWithCallback(
    pdu: Pdu,
    timeout: number = 10000
  ) {
    seq_num += 1;
    if (seq_num > 100000) {
      seq_num = 10;
    }
    pdu.updateSeqNo(seq_num);
    if (DEBUG) {
      console.log("sendPduWithCallback", getActionCommandsName(pdu.getCommandId()), "seq_num:", seq_num, pdu.getSeqNum());
    }
    return new Promise<Pdu>((resolve, reject) => {
      if (this.isConnect()) {
        this.__sending_msg_map[pdu.getSeqNum()] = true;
        this.send(pdu.getPbData());
        this.waitForMsgCallback(pdu.getSeqNum(), timeout)
          .then(resolve)
          .catch(reject);
      } else {
        this.reconnect(this.autoConnect);
        reject('BotWebSocketState is not connected');
      }
    });
  }

  isLogged() {
    return [BotWebSocketState.logged].includes(this.state);
  }

  isConnect() {
    return [BotWebSocketState.connected, BotWebSocketState.logged].includes(
      this.state
    );
  }

  async destroy() {
    this.client.close();
    this.setAutoConnect(false);
    await this.waitForMsgServerState(BotWebSocketState.closed);
  }
}
