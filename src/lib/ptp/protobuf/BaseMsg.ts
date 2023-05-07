const PB = require('./protobuf');

import type {
  ActionCommands
} from './ActionCommands';

let bbStack: BytesType[] = [];

export interface BytesType {
  bytes: Uint8Array;
  offset: number;
  limit: number;
}

export function popByteBuffer() {
  const bb = bbStack.pop();
  if (!bb) return { bytes: new Uint8Array(64), offset: 0, limit: 0 };
  bb.offset = bb.limit = 0;
  return bb;
}

export function toUint8Array(bb: BytesType) {
  let bytes = bb.bytes;
  let limit = bb.limit;
  return bytes.length === limit ? bytes : bytes.subarray(0, limit);
}

export function grow(bb: BytesType, count: number) {
  let bytes = bb.bytes;
  let offset = bb.offset;
  let limit = bb.limit;
  let finalOffset = offset + count;
  if (finalOffset > bytes.length) {
    let newBytes = new Uint8Array(finalOffset * 2);
    newBytes.set(bytes);
    bb.bytes = newBytes;
  }
  bb.offset = finalOffset;
  if (finalOffset > limit) {
    bb.limit = finalOffset;
  }
  return offset;
}

export function advance(bb: BytesType, count: number) {
  let offset = bb.offset;
  if (offset + count > bb.limit) {
    throw new Error('Read past limit');
  }
  bb.offset += count;
  return offset;
}

export function readInt32(bb: BytesType) {
  let offset = advance(bb, 4);
  let bytes = bb.bytes;
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  );
}

export function writeInt32(bb: BytesType, value: number) {
  let offset = grow(bb, 4);
  let bytes = bb.bytes;
  bytes[offset + 3] = value;
  bytes[offset + 2] = value >> 8;
  bytes[offset + 1] = value >> 16;
  bytes[offset] = value >> 24;
}

export function readInt16(bb: BytesType) {
  let offset = advance(bb, 2);
  let bytes = bb.bytes;

  return (bytes[offset] << 8) | bytes[offset + 1];
}

export function writeInt16(bb: BytesType, value: number) {
  let offset = grow(bb, 2);
  let bytes = bb.bytes;
  bytes[offset + 1] = value;
  bytes[offset] = value >> 8;
}

export function readBytes(bb: BytesType, count: number) {
  let offset = advance(bb, count);
  return bb.bytes.subarray(offset, offset + count);
}

export function writeBytes(bb: BytesType, buffer: Buffer) {
  let offset = grow(bb, buffer.length);
  bb.bytes.set(buffer, offset);
}

export function wrapByteBuffer(bytes: Uint8Array) {
  return { bytes, offset: 0, limit: bytes.length };
}

export const HEADER_LEN: number = 16;

export interface Header {
  length: number;
  version: number;
  flag: number;
  command_id: number;
  seq_num: number;
  reversed: number;
}

export class Pdu {
  private _pbData: Uint8Array;
  private _pbHeader: Header;
  private _pbBody: Uint8Array;
  private _bb: BytesType;

  constructor(data?: Uint8Array) {
    this._pbData = new Uint8Array();
    this._pbBody = new Uint8Array();
    this._bb = popByteBuffer();
    this._pbHeader = {
      length: 0,
      version: 0,
      flag: 0,
      command_id: 0,
      seq_num: 0,
      reversed: 0,
    };
    if (data) {
      this.setPbData(data);
      this.readPbData();
    }
  }

  getPbData(): Uint8Array {
    return this._pbData;
  }

  setPbData(data: Uint8Array) {
    this._pbData = data;
  }

  getPbDataLength(): number {
    return this._pbData.length;
  }

  getPbBody(): Uint8Array {
    return this._pbBody;
  }
  
  body(): Uint8Array {
    return this._pbBody;
  }

  getPbBodyLength(): number {
    return this._pbBody.length;
  }

  setPbBody(body: Uint8Array) {
    this._pbBody = body;
  }

  writeData(
    body: Uint8Array,
    command_id: ActionCommands,
    seq_num: number = 0,
    reversed: number = 0
  ) {
    this.setPbBody(body);

    this._pbHeader = {
      length: body.length + HEADER_LEN,
      version: 0,
      flag: 0,
      command_id,
      seq_num: seq_num,
      reversed,
    };
    writeInt32(this._bb, this._pbHeader.length);
    writeInt16(this._bb, this._pbHeader.version);
    writeInt16(this._bb, this._pbHeader.flag);
    writeInt16(this._bb, this._pbHeader.command_id);
    writeInt16(this._bb, this._pbHeader.seq_num);
    writeInt32(this._bb, this._pbHeader.reversed);
    writeBytes(this._bb, Buffer.from(body));
    this.setPbData(toUint8Array(this._bb));
  }

  public updateSeqNo(seq_num:number){
    this._bb = wrapByteBuffer(this._pbData)
    this._bb.offset = 10;
    writeInt16(this._bb, seq_num);
    this._pbHeader.seq_num = seq_num;
    this.setPbData(toUint8Array(this._bb));
  }
  readPbData() {
    const headerBb = wrapByteBuffer(this._pbData.slice(0, HEADER_LEN));
    this._pbHeader.length = readInt32(headerBb);
    this._pbHeader.version = readInt16(headerBb);
    this._pbHeader.flag = readInt16(headerBb);
    this._pbHeader.command_id = readInt16(headerBb);
    this._pbHeader.seq_num = readInt16(headerBb);
    this._pbHeader.reversed = readInt32(headerBb);
    this.setPbBody(this._pbData.slice(HEADER_LEN, this._pbHeader.length));
  }

  getCommandId(): ActionCommands {
    return this._pbHeader.command_id;
  }

  getReversed(): number {
    return this._pbHeader.reversed;
  }
  getSeqNum(): number {
    return this._pbHeader.seq_num;
  }
}

export default class BaseMsg {
  private __cid?: any;
  public msg?: any;
  private __pb: any;
  constructor(namespace: string, msg?: any) {
    const t = namespace.split('.');
    let pb = PB.default;
    do {
      const k = t.shift();
      // @ts-ignore
      pb = pb[k];
    } while (t.length > 0);
    this.__pb = pb;
    this.setMsg(msg);
  }
  protected setCommandId(cid: any) {
    this.__cid = cid;
  }
  setMsg(msg: any) {
    this.msg = msg;
  }
  getMsg() {
    return this.msg;
  }
  encode(): Uint8Array {
    return this.__E();
  }
  decode(data: Uint8Array) {
    return this.__D(data);
  }
  pack(): Pdu {
    return this.__pack();
  }
  toHex(): string {
    return Buffer.from(this.__E()).toString('hex');
  }
  fromHex(hexStr: string): any {
    if (hexStr.indexOf('0x') === 0) {
      hexStr = hexStr.substring(2);
    }
    return this.__D(Buffer.from(hexStr, 'hex'));
  }
  protected __E(): Uint8Array {
    const obj = this.__pb.create(this.getMsg());
    return this.__pb.encode(obj).finish();
  }
  protected __D(data: Uint8Array): any {
    const obj = this.__pb.decode(data);
    return this.__pb.toObject(obj);
  }
  protected __pack(): Pdu {
    const pdu = new Pdu();
    pdu.writeData(this.__E(), this.__cid, 0);
    return pdu;
  }
}

