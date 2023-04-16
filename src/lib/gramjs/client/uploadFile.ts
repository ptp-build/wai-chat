// eslint-disable-next-line import/no-named-default
import {default as Api} from '../tl/api';

import type TelegramClient from './TelegramClient';
import {generateRandomBytes, readBigIntFromBuffer, sleep} from '../Helpers';
import {getUploadPartSize} from '../Utils';
import errors from '../errors';
import {Foreman} from '../../../util/foreman';
import {DownloadRes, UploadReq} from "../../ptp/protobuf/PTPFile";
import {CLOUD_MESSAGE_API, DEBUG, MEDIA_CACHE_NAME_WAI} from "../../../config";
import localDb from "../../../api/gramjs/localDb";
import Account from "../../../worker/share/Account";
import * as cacheApi from '../../../util/cacheApi';
import {Type} from '../../../util/cacheApi';
import {fileToBuffer} from "../../../worker/share/utils/utils";
import {ERR, FileInfo_Type} from "../../ptp/protobuf/PTPCommon/types";
import {Pdu} from "../../ptp/protobuf/BaseMsg";
import {blobToBuffer} from "../../../util/files";

interface OnProgress {
    isCanceled?: boolean;

    // Float between 0 and 1.
    (progress: number): void;
}

export interface UploadFileParams {
    file: File;
    workers?: number;
    onProgress?: OnProgress;
}

const KB_TO_BYTES = 1024;
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024;
const DISCONNECT_SLEEP = 1000;
const MAX_CONCURRENT_CONNECTIONS = 3;
const MAX_CONCURRENT_CONNECTIONS_PREMIUM = 6;
const MAX_WORKERS_PER_CONNECTION = 10;

const foremans = Array(MAX_CONCURRENT_CONNECTIONS_PREMIUM).fill(undefined)
    .map(() => new Foreman(MAX_WORKERS_PER_CONNECTION));

export async function uploadFileV1(
    fileParams: UploadFileParams,
): Promise<Api.InputFile | Api.InputFileBig> {
    const { file, onProgress } = fileParams;
    const { name, size } = file;
    let fileId1 = readBigIntFromBuffer(generateRandomBytes(8), true, true);
    let fileIdStr = fileId1.toString().replace("-","").replace("n","")
    const fileId = Number(fileIdStr)
    fileIdStr = String(fileId)
    localDb.cache[fileIdStr] = file;
    const isLarge = size > LARGE_FILE_THRESHOLD;

    const partSize = getUploadPartSize(size) * KB_TO_BYTES;
    const partCount = Math.floor((size + partSize - 1) / partSize);

    let progress = 0;
    if (onProgress) {
        onProgress(progress);
    }
    const buf = await fileToBuffer(file)
    const cipher = Account.localEncrypt(Buffer.from(buf));
    const body = new DownloadRes({
        file:{
            id:fileIdStr,
            part:0,
            part_total:1,
            buf:cipher,
            size,
            type:file.type
        },
        err:ERR.NO_ERROR
    }).pack().getPbData()

    const blob = new Blob([Buffer.from(body)]);
    await cacheApi.save(MEDIA_CACHE_NAME_WAI, fileIdStr, blob);

    return isLarge
        ? new Api.InputFileBig({
            id: fileId,
            parts: partCount,
            name,
        })
        : new Api.InputFile({
            id: fileId,
            parts: partCount,
            name,
            md5Checksum: '', // This is not a "flag", so not sure if we can make it optional.
        });
}


export async function uploadFileCache(
    file: FileInfo_Type,
) {
    const { buf, id } = file;
    const size = buf.length
    const fileIdStr = id;

    const partSize = getUploadPartSize(size) * KB_TO_BYTES;
    const partCount = Math.floor((size + partSize - 1) / partSize);
    const activeCounts = foremans.map(({ activeWorkers }) => activeWorkers);
    let currentForemanIndex = activeCounts.indexOf(Math.min(...activeCounts));

    const promises: Promise<any>[] = [];

    for (let i = 0; i < partCount; i++) {
        const senderIndex = currentForemanIndex % MAX_CONCURRENT_CONNECTIONS_PREMIUM;
        await foremans[senderIndex].requestWorker();
        const blobSlice = buf.subarray(i * partSize, (i + 1) * partSize);
        promises.push((async (jMemo: number, blobSliceMemo: Buffer) => {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                try {
                    if(CLOUD_MESSAGE_API && Account.getCurrentAccount()?.getSession()){
                        if(DEBUG){
                            console.log("uploadProfilePhoto",fileIdStr,jMemo,partCount)
                        }
                        const fileInfo = {
                            id:fileIdStr,
                            size:file.size,
                            type:file.type,
                            part:jMemo+1,
                            part_total:partCount,
                            buf:blobSliceMemo
                        }
                        const uploadReq = new UploadReq({file:fileInfo})
                        const body = Buffer.from(uploadReq.pack().getPbData());
                        await fetch(`${CLOUD_MESSAGE_API}/proto`,{
                            method: 'POST',
                            body,
                            headers:{
                                Authorization: `Bearer ${Account.getCurrentAccount()?.getSession()}`,
                            }
                        })
                    }
                } catch (err) {
                    foremans[senderIndex].releaseWorker();
                    throw err;
                }

                foremans[senderIndex].releaseWorker();
                break;
            }
        })(i, blobSlice));

        currentForemanIndex++;
    }
    await Promise.all(promises);
}


export async function uploadFile(
    client: TelegramClient,
    fileParams: UploadFileParams,
): Promise<Api.InputFile | Api.InputFileBig> {
    const { file, onProgress } = fileParams;

    const isPremium = Boolean(client.isPremium);

    const { name, size } = file;
    const fileId = readBigIntFromBuffer(generateRandomBytes(8), true, true);
    const isLarge = size > LARGE_FILE_THRESHOLD;

    const partSize = getUploadPartSize(size) * KB_TO_BYTES;
    const partCount = Math.floor((size + partSize - 1) / partSize);

    // Pick the least busy foreman
    // For some reason, fresh connections give out a higher speed for the first couple of seconds
    // I have no idea why, but this may speed up the download of small files
    const activeCounts = foremans.map(({ activeWorkers }) => activeWorkers);
    let currentForemanIndex = activeCounts.indexOf(Math.min(...activeCounts));

    let progress = 0;
    if (onProgress) {
        onProgress(progress);
    }

    const promises: Promise<any>[] = [];

    for (let i = 0; i < partCount; i++) {
        const senderIndex = currentForemanIndex % (
            isPremium ? MAX_CONCURRENT_CONNECTIONS_PREMIUM : MAX_CONCURRENT_CONNECTIONS
        );

        await foremans[senderIndex].requestWorker();

        if (onProgress?.isCanceled) {
            foremans[senderIndex].releaseWorker();
            break;
        }

        const blobSlice = file.slice(i * partSize, (i + 1) * partSize);
        // eslint-disable-next-line no-loop-func, @typescript-eslint/no-loop-func
        promises.push((async (jMemo: number, blobSliceMemo: Blob) => {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                let sender;
                try {
                    // We always upload from the DC we are in
                    sender = await client.getSender(client.session.dcId, senderIndex, isPremium);
                    const partBytes = await blobSliceMemo.arrayBuffer();
                    await sender.send(
                        isLarge
                            ? new Api.upload.SaveBigFilePart({
                                fileId,
                                filePart: jMemo,
                                fileTotalParts: partCount,
                                bytes: Buffer.from(partBytes),
                            })
                            : new Api.upload.SaveFilePart({
                                fileId,
                                filePart: jMemo,
                                bytes: Buffer.from(partBytes),
                            }),
                    );
                } catch (err) {
                    if (sender && !sender.isConnected()) {
                        await sleep(DISCONNECT_SLEEP);
                        continue;
                    } else if (err instanceof errors.FloodWaitError) {
                        await sleep(err.seconds * 1000);
                        continue;
                    }
                    foremans[senderIndex].releaseWorker();

                    throw err;
                }

                foremans[senderIndex].releaseWorker();

                if (onProgress) {
                    if (onProgress.isCanceled) {
                        throw new Error('USER_CANCELED');
                    }

                    progress += (1 / partCount);
                    onProgress(progress);
                }
                break;
            }
        })(i, blobSlice));

        currentForemanIndex++;
    }

    await Promise.all(promises);

    return isLarge
        ? new Api.InputFileBig({
            id: fileId,
            parts: partCount,
            name,
        })
        : new Api.InputFile({
            id: fileId,
            parts: partCount,
            name,
            md5Checksum: '', // This is not a "flag", so not sure if we can make it optional.
        });
}
