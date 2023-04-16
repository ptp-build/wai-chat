import type {TelegramClient} from '../../../lib/gramjs';
import {Api as GramJs} from '../../../lib/gramjs';
import type {ApiOnProgress, ApiParsedMedia} from '../../types';
import {ApiMediaFormat,} from '../../types';

import {
  CLOUD_MESSAGE_API,
  DOWNLOAD_WORKERS,
  MEDIA_CACHE_DISABLED,
  MEDIA_CACHE_NAME,
  MEDIA_CACHE_NAME_AVATARS,
  MEDIA_CACHE_NAME_WAI,
} from '../../../config';
import localDb from '../localDb';
import * as cacheApi from '../../../util/cacheApi';
import {Type} from '../../../util/cacheApi';
import {getEntityTypeById} from '../gramjsBuilders';
import {DownloadReq, DownloadRes} from "../../../lib/ptp/protobuf/PTPFile";
import {ERR} from "../../../lib/ptp/protobuf/PTPCommon/types";
import {Pdu} from "../../../lib/ptp/protobuf/BaseMsg";
import Account from "../../../worker/share/Account";
import {blobToBuffer} from "../../../worker/share/utils/utils";

const MEDIA_ENTITY_TYPES = new Set([
  'msg', 'sticker', 'gif', 'wallpaper', 'photo', 'webDocument', 'document', 'videoAvatar',
]);


async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result as ArrayBuffer);
    };

    reader.onerror = () => {
      reject(reader.error);
    };

    reader.readAsArrayBuffer(file);
  });
}

export default async function downloadMedia(
  {
    url, mediaFormat, start, end, isHtmlAllowed,
  }: {
    url: string; mediaFormat: ApiMediaFormat; start?: number; end?: number; isHtmlAllowed?: boolean;
  },
  client: TelegramClient,
  isConnected: boolean,
  onProgress?: ApiOnProgress,
) {
  let data:Buffer,fullSize:number,mimeType:string;
  let flag = false;
  let id;
  const t = url.split("?")
  const t1 = t[0].split(":");
  if(url.indexOf("progressive") > 0 || t1[0].indexOf("-") > 1){
    id = t1[t1.length - 1];
  }else{
    // "profile623415?7116860199581299000"
    if(url.indexOf("profile") === 0){
      if(url.indexOf("?") > -1){
        id = url.split("?")[1]
      }else {
        id = url.replace("profile","")
      }
    }else if(url.indexOf("avatar") === 0){
      id = url.split("?")[1]
    }else if(url.indexOf("photo") === 0){
      id = url.split("?")[0].replace("photo","")
    }else{
      console.error("[error id] ",url)
      return undefined
    }
  }

  if(localDb.cache[id]){
    const ab = await fileToArrayBuffer(localDb.cache[id]);
    mimeType = localDb.cache[id].type;
    //blob = new Blob([ab], { type: mimeType });
    fullSize = localDb.cache[id].size
    data = Buffer.from(ab)
    flag = true;
  }

  if(!flag){
    // const  res = await download(url, client, isConnected, onProgress, start, end, mediaFormat, isHtmlAllowed) || {};
    // if(!res){
    //   return undefined
    // }
    // data = res.data;
    // mimeType = res.mimeType;
    // fullSize = res.fullSize;
    // if (!data) {
    //   return undefined;
    // }

    let downloadReq = new DownloadReq({
      id,
    })
    try {
      console.log("[DOWNLOAD media]",{url,id})
      let blob = await cacheApi.fetch(MEDIA_CACHE_NAME_WAI, id, Type.Blob);
      let downloadRes;
      let arrayBuffer;
      if(!blob){
        let finalBuf = Buffer.alloc(0);
        while (true){
          const res = await fetch(`${CLOUD_MESSAGE_API}/proto`,{
            method: 'POST',
            body: Buffer.from(downloadReq.pack().getPbData())
          })
          arrayBuffer = await res.arrayBuffer();
          downloadRes = DownloadRes.parseMsg(new Pdu(Buffer.from(arrayBuffer)));
          if(!downloadRes || downloadRes.err !== ERR.NO_ERROR || !downloadRes.file){
            return undefined
          }
          finalBuf = Buffer.concat([finalBuf,Buffer.from(downloadRes.file.buf)])
          if(downloadRes.file.part_total && downloadRes.file.part < downloadRes.file.part_total){
            downloadReq = new DownloadReq({
              id,
              part:downloadRes.file.part+1
            })
          }else{
            downloadRes.file!.buf = finalBuf
            try {
              const body = new DownloadRes(downloadRes).pack().getPbData()
              await cacheApi.save(MEDIA_CACHE_NAME_WAI, id, new Blob([Buffer.from(body)]));
              downloadRes.file.buf = Account.localDecrypt(finalBuf)
            }catch (e){
              console.error(e)
              return undefined
            }
            break
          }
        }
      }else{
        // @ts-ignore
        const buf = await blobToBuffer(blob)
        downloadRes = DownloadRes.parseMsg(new Pdu(buf));
        if(!downloadRes || downloadRes.err !== ERR.NO_ERROR){
          return undefined
        }
        try {
          downloadRes.file!.buf = Account.localDecrypt(Buffer.from(downloadRes.file!.buf))
        }catch (e){}
      }
      data = Buffer.from(downloadRes.file!.buf);
      mimeType= downloadRes.file!.type
      fullSize = downloadRes.file!.size
    }catch (e){
      console.error('[DOWNLOAD FAILED]',e,{url,id})
      return undefined
    }
  }
  const parsed = await parseMedia(data, mediaFormat, mimeType);
  if (!parsed) {
    return undefined;
  }
  //
  // const canCache = mediaFormat !== ApiMediaFormat.Progressive && (
  //   mediaFormat !== ApiMediaFormat.BlobUrl || (parsed as Blob).size <= MEDIA_CACHE_MAX_BYTES
  // );

  const canCache = mediaFormat !== ApiMediaFormat.Progressive
  if (!MEDIA_CACHE_DISABLED && cacheApi && canCache) {
    const cacheName = url.startsWith('avatar') ? MEDIA_CACHE_NAME_AVATARS : MEDIA_CACHE_NAME;
    void cacheApi.save(cacheName, url, parsed);
  }

  const dataBlob = mediaFormat === ApiMediaFormat.Progressive ? '' : parsed as string | Blob;
  const arrayBuffer = mediaFormat === ApiMediaFormat.Progressive ? parsed as ArrayBuffer : undefined;

  return {
    dataBlob,
    arrayBuffer,
    mimeType,
    fullSize,
  };
}

export type EntityType = (
  'msg' | 'sticker' | 'wallpaper' | 'gif' | 'channel' | 'chat' | 'user' | 'photo' | 'stickerSet' | 'webDocument' |
  'document' | 'staticMap' | 'videoAvatar'
);

async function download(
  url: string,
  client: TelegramClient,
  isConnected: boolean,
  onProgress?: ApiOnProgress,
  start?: number,
  end?: number,
  mediaFormat?: ApiMediaFormat,
  isHtmlAllowed?: boolean,
) {
  const parsed = parseMediaUrl(url);

  if (!parsed) return undefined;

  const {
    entityType, entityId, sizeType, params, mediaMatchType,
  } = parsed;

  // if (!isConnected) {
  //   return Promise.reject(new Error('ERROR: Client is not connected'));
  // }

  if (entityType === 'staticMap') {
    const accessHash = entityId;
    const parsedParams = new URLSearchParams(params);
    const long = parsedParams.get('long');
    const lat = parsedParams.get('lat');
    const w = parsedParams.get('w');
    const h = parsedParams.get('h');
    const zoom = parsedParams.get('zoom');
    const scale = parsedParams.get('scale');
    const accuracyRadius = parsedParams.get('accuracy_radius');

    const data = await client.downloadStaticMap(accessHash, long, lat, w, h, zoom, scale, accuracyRadius);
    return {
      mimeType: 'image/png',
      data,
    };
  }

  let entity: (
    GramJs.User | GramJs.Chat | GramJs.Channel | GramJs.Photo |
    GramJs.Message | GramJs.MessageService |
    GramJs.Document | GramJs.StickerSet | GramJs.TypeWebDocument | undefined
  );

  switch (entityType) {
    case 'channel':
    case 'chat':
      entity = localDb.chats[entityId];
      break;
    case 'user':
      entity = localDb.users[entityId];
      break;
    case 'msg':
      entity = localDb.messages[entityId];
      break;
    case 'sticker':
    case 'gif':
    case 'wallpaper':
      entity = localDb.documents[entityId];
      break;
    case 'videoAvatar':
    case 'photo':
      entity = localDb.photos[entityId];
      break;
    case 'stickerSet':
      entity = localDb.stickerSets[entityId];
      break;
    case 'webDocument':
      entity = localDb.webDocuments[entityId];
      break;
    case 'document':
      entity = localDb.documents[entityId];
      break;
  }

  if (!entity) {
    return undefined;
  }

  if (MEDIA_ENTITY_TYPES.has(entityType)) {
    if (mediaFormat === ApiMediaFormat.Stream) {
      onProgress!.acceptsBuffer = true;
    }

    const data = await client.downloadMedia(entity, {
      sizeType, start, end, progressCallback: onProgress, workers: DOWNLOAD_WORKERS,
    });
    let mimeType;
    let fullSize;

    if (entity instanceof GramJs.MessageService && entity.action instanceof GramJs.MessageActionSuggestProfilePhoto) {
      mimeType = 'image/jpeg';
    } else if (entity instanceof GramJs.Message) {
      mimeType = getMessageMediaMimeType(entity, sizeType);
      if (entity.media instanceof GramJs.MessageMediaDocument && entity.media.document instanceof GramJs.Document) {
        fullSize = entity.media.document.size.toJSNumber();
      }
      if (entity.media instanceof GramJs.MessageMediaWebPage
        && entity.media.webpage instanceof GramJs.WebPage
        && entity.media.webpage.document instanceof GramJs.Document) {
        fullSize = entity.media.webpage.document.size.toJSNumber();
      }
    } else if (entity instanceof GramJs.Photo) {
      if (entityType === 'videoAvatar') {
        mimeType = 'video/mp4';
      } else {
        mimeType = 'image/jpeg';
      }
    } else if (entityType === 'sticker' && sizeType) {
      mimeType = 'image/webp';
    } else if (entityType === 'webDocument') {
      mimeType = (entity as GramJs.TypeWebDocument).mimeType;
      fullSize = (entity as GramJs.TypeWebDocument).size;
    } else {
      mimeType = (entity as GramJs.Document).mimeType;
      fullSize = (entity as GramJs.Document).size.toJSNumber();
    }

    // Prevent HTML-in-video attacks
    if (!isHtmlAllowed && mimeType) {
      mimeType = mimeType.replace(/html/gi, '');
    }

    return { mimeType, data, fullSize };
  } else if (entityType === 'stickerSet') {
    const data = await client.downloadStickerSetThumb(entity);
    const mimeType = getMimeType(data);

    return { mimeType, data };
  } else {
    const data = await client.downloadProfilePhoto(entity, mediaMatchType === 'profile');
    const mimeType = getMimeType(data);

    return { mimeType, data };
  }
}

function getMessageMediaMimeType(message: GramJs.Message, sizeType?: string) {
  if (!message || !message.media) {
    return undefined;
  }

  if (message.media instanceof GramJs.MessageMediaPhoto) {
    return 'image/jpeg';
  }

  if (message.media instanceof GramJs.MessageMediaGeo
    || message.media instanceof GramJs.MessageMediaVenue
    || message.media instanceof GramJs.MessageMediaGeoLive) {
    return 'image/png';
  }

  if (message.media instanceof GramJs.MessageMediaDocument && message.media.document instanceof GramJs.Document) {
    if (sizeType) {
      return message.media.document!.attributes.some((a) => a instanceof GramJs.DocumentAttributeSticker)
        ? 'image/webp'
        : 'image/jpeg';
    }

    return message.media.document!.mimeType;
  }

  if (message.media instanceof GramJs.MessageMediaWebPage
    && message.media.webpage instanceof GramJs.WebPage
    && message.media.webpage.document instanceof GramJs.Document) {
    if (sizeType) {
      return 'image/jpeg';
    }

    return message.media.webpage.document.mimeType;
  }

  return undefined;
}

// eslint-disable-next-line no-async-without-await/no-async-without-await
async function parseMedia(
  data: Buffer, mediaFormat: ApiMediaFormat, mimeType?: string,
): Promise<ApiParsedMedia | undefined> {
  switch (mediaFormat) {
    case ApiMediaFormat.BlobUrl:
      return new Blob([data], { type: mimeType });
    case ApiMediaFormat.Text:
      return data.toString();
    case ApiMediaFormat.Progressive:
    case ApiMediaFormat.DownloadUrl:
      return data.buffer;
  }

  return undefined;
}

function getMimeType(data: Uint8Array, fallbackMimeType = 'image/jpeg') {
  if (data.length < 4) {
    return fallbackMimeType;
  }

  let type = fallbackMimeType;
  const signature = data.subarray(0, 4).reduce((result, byte) => result + byte.toString(16), '');

  // https://en.wikipedia.org/wiki/List_of_file_signatures
  switch (signature) {
    case '89504e47':
      type = 'image/png';
      break;
    case '47494638':
      type = 'image/gif';
      break;
    case 'ffd8ffe0':
    case 'ffd8ffe1':
    case 'ffd8ffe2':
    case 'ffd8ffe3':
    case 'ffd8ffe8':
      type = 'image/jpeg';
      break;
    case '52494646':
      // In our case only webp is expected
      type = 'image/webp';
      break;
  }

  return type;
}

export function parseMediaUrl(url: string) {
  const mediaMatch = url.startsWith('staticMap')
    ? url.match(/(staticMap):([0-9-]+)(\?.+)/)
    : url.startsWith('webDocument')
      ? url.match(/(webDocument):(.+)/)
      : url.match(
        // eslint-disable-next-line max-len
        /(avatar|profile|photo|msg|stickerSet|sticker|wallpaper|gif|document|videoAvatar)([-\d\w./]+)(?::\d+)?(\?size=\w+)?/,
      );
  if (!mediaMatch) {
    return undefined;
  }

  const mediaMatchType = mediaMatch[1];
  const entityId: string | number = mediaMatch[2];

  let entityType: EntityType;
  const params = mediaMatch[3];
  const sizeType = params?.replace('?size=', '') || undefined;

  if (mediaMatch[1] === 'avatar' || mediaMatch[1] === 'profile') {
    entityType = getEntityTypeById(entityId);
  } else {
    entityType = mediaMatch[1] as EntityType;
  }

  return {
    mediaMatchType,
    entityType,
    entityId,
    sizeType,
    params,
  };
}
