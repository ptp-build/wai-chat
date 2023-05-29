import {callApi} from "../../api/gramjs";
import {Pdu} from "../../lib/ptp/protobuf/BaseMsg";

export type CallApiWithPduRes = {
  pdu: Pdu
}

export async function callApiWithPdu(pdu: Pdu): Promise<undefined | CallApiWithPduRes> {
  //@ts-ignore
  const buf = await callApi("sendWithCallback", Buffer.from(pdu.getPbData()));
  if (buf) {
    return {pdu: new Pdu(Buffer.from(buf))};
  } else {
    return undefined;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
