import {DownloadReq, DownloadRes, UploadReq} from '../../../lib/ptp/protobuf/PTPFile';
import {Pdu} from '../../../lib/ptp/protobuf/BaseMsg';
import {storage} from '../../env';
import {ERR} from '../../../lib/ptp/protobuf/PTPCommon/types';
import {FileInfo} from '../../../lib/ptp/protobuf/PTPCommon';
import {getCorsHeader} from '../utils/utils';

export async function Upload(pdu: Pdu) {
	const req = UploadReq.parseMsg(pdu);
	const { id, part, part_total, size, type,buf } = req.file;
	console.log('[UPLOAD]', id, part, part_total, size,buf.length);
  const buff = new FileInfo(req.file).encode();
	await storage.put(`media/${id}_${part}`, buff);
  return new Response('', {
		status: 200,
		headers: {
			...getCorsHeader(),
		},
	});
}

export async function Download(pdu: Pdu) {
	const req = DownloadReq.parseMsg(pdu);
	console.log('[Download]', req.id,req.part || 1);
	let body;
	try {
    const res = await storage.get(`media/${req.id}_${(req.part || 1 )}`);
    if (!res) {
      throw new Error('Not Found media');
    }
    const fileInfo = new FileInfo().decode(Uint8Array.from(res));

		body = Buffer.from(
			new DownloadRes({
				file: fileInfo,
				err: ERR.NO_ERROR,
			})
				.pack()
				.getPbData()
		);
	} catch (e) {
		console.error('[Download]', e);
		body = Buffer.from(
			new DownloadRes({
				err: ERR.ERR_SYSTEM,
			})
				.pack()
				.getPbData()
		);
	}
	return new Response(body, {
		status: 200,
		headers: {
			...getCorsHeader(),
		},
	});
}
