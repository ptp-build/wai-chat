import {Api as GramJs} from '../../../lib/gramjs';
import type {
  ApiAttachment,
  ApiBotInfo,
  ApiChat,
  ApiContact,
  ApiFormattedText,
  ApiGlobalMessageSearchType,
  ApiMessage,
  ApiMessageEntity,
  ApiMessageSearchType,
  ApiNewPoll,
  ApiOnProgress,
  ApiPoll,
  ApiReportReason,
  ApiSendMessageAction,
  ApiSticker,
  ApiUser,
  ApiVideo,
  OnApiUpdate,
} from '../../types';
import {MAIN_THREAD_ID, MESSAGE_DELETED,} from '../../types';

import {
  ALL_FOLDER_ID,
  DEBUG,
  GIF_MIME_TYPE,
  MAX_INT_32,
  MENTION_UNREAD_SLICE,
  MESSAGE_LIST_SLICE,
  PINNED_MESSAGES_LIMIT,
  REACTION_UNREAD_SLICE,
  SUPPORTED_IMAGE_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
  UPLOAD_WORKERS,
} from '../../../config';
import {invokeRequest} from './client';
import {
  buildApiFormattedText,
  buildApiMessage,
  buildApiSponsoredMessage,
  buildLocalForwardedMessage,
  buildLocalMessage,
  buildWebPage,
} from '../apiBuilders/messages';
import {buildApiUser} from '../apiBuilders/users';
import {
  buildInputEntity,
  buildInputMediaDocument,
  buildInputPeer,
  buildInputPoll,
  buildInputPollFromExisting,
  buildInputReportReason,
  buildInputTextWithEntities,
  buildMtpMessageEntity,
  buildSendMessageAction,
  generateRandomBigInt,
  getEntityTypeById,
  isMessageWithMedia,
  isServiceMessageWithMedia,
} from '../gramjsBuilders';
import localDb from '../localDb';
import {buildApiChatFromPreview, buildApiSendAsPeerId} from '../apiBuilders/chats';
import {blobToDataUri, fetchBlob, fetchFile} from '../../../util/files';
import {
  addEntitiesWithPhotosToLocalDb,
  addMessageToLocalDb,
  deserializeBytes,
  resolveMessageApiChatId,
} from '../helpers';
import {interpolateArray} from '../../../util/waveform';
import {requestChatUpdate} from './chats';
import {getEmojiOnlyCountForMessage} from '../../../global/helpers/getEmojiOnlyCountForMessage';
import {getServerTimeOffset} from '../../../util/serverTime';
import {uploadFileV1} from "../../../lib/gramjs/client/uploadFile";
import {MsgListReq, MsgListRes} from "../../../lib/ptp/protobuf/PTPMsg";
import Account from '../../../worker/share/Account';
import {ERR} from "../../../lib/ptp/protobuf/PTPCommon/types";
import MsgWorker from "../../../worker/msg/MsgWorker";

const FAST_SEND_TIMEOUT = 1000;
const INPUT_WAVEFORM_LENGTH = 63;

type TranslateTextParams = ({
  text: ApiFormattedText[];
} | {
  chat: ApiChat;
  messageIds: number[];
}) & {
  toLanguageCode: string;
};

let onUpdate: OnApiUpdate;

export function init(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export async function fetchMessages({
  chat,
  threadId,
  offsetId,
  lastMessageId,isUp,
  ...pagination
}: {
  chat: ApiChat;
  threadId?: number;
  offsetId?: number;
  addOffset?: number;
  limit: number;
  lastMessageId?:number,
  isUp?:boolean
}) {
  return
  const pdu = await Account.getCurrentAccount()?.sendPduWithCallback(new MsgListReq({
    lastMessageId:lastMessageId!,
    chatId:chat.id,
    limit: MESSAGE_LIST_SLICE,
    isUp
  }).pack());
  if(!pdu){
    return
  }
  const res = MsgListRes.parseMsg(pdu!)
  if(res.err !== ERR.NO_ERROR){
    return;
  }
  const result = JSON.parse(res!.payload)
  if(!result){
    return
  }
  return result
  // const RequestClass = threadId === MAIN_THREAD_ID ? GramJs.messages.GetHistory : GramJs.messages.GetReplies;
  // let result;
  //
  // try {
  //   result = await invokeRequest(new RequestClass({
  //     peer: buildInputPeer(chat.id, chat.accessHash),
  //     ...(threadId !== MAIN_THREAD_ID && {
  //       msgId: Number(threadId),
  //     }),
  //     ...(offsetId && {
  //       // Workaround for local message IDs overflowing some internal `Buffer` range check
  //       offsetId: Math.min(offsetId, MAX_INT_32),
  //     }),
  //     ...pagination,
  //   }), undefined, true);
  // } catch (err: any) {
  //   if (err.message === 'CHANNEL_PRIVATE') {
  //     onUpdate({
  //       '@type': 'updateChat',
  //       id: chat.id,
  //       chat: {
  //         isRestricted: true,
  //       },
  //     });
  //   }
  // }
  //
  // if (
  //   !result
  //   || result instanceof GramJs.messages.MessagesNotModified
  //   || !result.messages
  // ) {
  //   return undefined;
  // }
  //
  // updateLocalDb(result);
  //
  // const messages = result.messages.map(buildApiMessage).filter(Boolean);
  // const users = result.users.map(buildApiUser).filter(Boolean);
  // const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);
  // const repliesThreadInfos = messages.map(({ repliesThreadInfo }) => repliesThreadInfo).filter(Boolean);
  //
  // return {
  //   messages,
  //   users,
  //   chats,
  //   repliesThreadInfos,
  // };
}

export async function fetchMessage({ chat, messageId }: { chat: ApiChat; messageId: number }) {
  const isChannel = getEntityTypeById(chat.id) === 'channel';

  let result;
  try {
    result = await invokeRequest(
      isChannel
        ? new GramJs.channels.GetMessages({
          channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
          id: [new GramJs.InputMessageID({ id: messageId })],
        })
        : new GramJs.messages.GetMessages({
          id: [new GramJs.InputMessageID({ id: messageId })],
        }),
      undefined,
      true,
    );
  } catch (err: any) {
    const { message } = err;

    // When fetching messages for the bot @replies, there may be situations when the user was banned
    // in the comment group or this group was deleted
    if (message !== 'CHANNEL_PRIVATE') {
      onUpdate({
        '@type': 'error',
        error: {
          message,
          isSlowMode: false,
          hasErrorKey: true,
        },
      });
    }
  }

  if (!result || result instanceof GramJs.messages.MessagesNotModified) {
    return undefined;
  }

  const mtpMessage = result.messages[0];
  if (!mtpMessage) {
    return undefined;
  }

  if (mtpMessage instanceof GramJs.MessageEmpty) {
    return MESSAGE_DELETED;
  }

  const message = mtpMessage && buildApiMessage(mtpMessage);
  if (!message) {
    return undefined;
  }

  if (mtpMessage instanceof GramJs.Message) {
    addMessageToLocalDb(mtpMessage);
  }

  const users = result.users.map(buildApiUser).filter(Boolean);

  return { message, users };
}

let queue = Promise.resolve();


export function sendMessage(
  {
    chat,
    text,
    entities,
    replyingTo,
    replyingToTopId,
    attachment,
    sticker,
    gif,
    poll,
    contact,
    isSilent,
    scheduledAt,
    groupedId,
    noWebPage,
    sendAs,
    shouldUpdateStickerSetsOrder,
    botInfo
  }: {
    chat: ApiChat;
    text?: string;
    entities?: ApiMessageEntity[];
    replyingTo?: number;
    replyingToTopId?: number;
    attachment?: ApiAttachment;
    sticker?: ApiSticker;
    gif?: ApiVideo;
    poll?: ApiNewPoll;
    contact?: ApiContact;
    isSilent?: boolean;
    scheduledAt?: number;
    groupedId?: string;
    noWebPage?: boolean;
    sendAs?: ApiUser | ApiChat;
    shouldUpdateStickerSetsOrder?: boolean;
    botInfo?: ApiBotInfo;
  },
  onProgress?: ApiOnProgress,
) {
  const localMessage = buildLocalMessage(
    chat,
    text,
    entities,
    replyingTo,
    replyingToTopId,
    attachment,
    sticker,
    gif,
    poll,
    contact,
    groupedId,
    scheduledAt,
    sendAs,
  );

  onUpdate({
    '@type': localMessage.isScheduled ? 'newScheduledMessage' : 'newMessage',
    id: localMessage.id,
    chatId: chat.id,
    message: {
      ...localMessage,
      sendingState: 'messageSendingStatePending',
    },
  });


  const randomId = generateRandomBigInt();
  localDb.localMessages[String(randomId)] = localMessage;

  if (groupedId) {
    return sendGroupedMedia({
      chat,
      text,
      entities,
      replyingTo,
      replyingToTopId,
      attachment: attachment!,
      groupedId,
      isSilent,
      scheduledAt,
    }, randomId, localMessage, onProgress);
  }

  const prevQueue = queue;
  queue = (async () => {
    let media: GramJs.TypeInputMedia | undefined;
    if (attachment) {
      try {
        media = await uploadMedia(localMessage, attachment, onProgress!);
      } catch (err) {
        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.warn(err);
        }
        await prevQueue;
        return;
      }
    } else if (sticker) {
      media = buildInputMediaDocument(sticker);
    } else if (gif) {
      media = buildInputMediaDocument(gif);
    } else if (poll) {
      media = buildInputPoll(poll, randomId);
    } else if (contact) {
      media = new GramJs.InputMediaContact({
        phoneNumber: contact.phoneNumber,
        firstName: contact.firstName,
        lastName: contact.lastName,
        vcard: '',
      });
    }
    await prevQueue;
    await new MsgWorker({
      chat,
      msgSend:localMessage,
      attachment,
      media,
      botInfo,
    },onUpdate).process()
  })();

  return queue;
}

const groupedUploads: Record<string, {
  counter: number;
  singleMediaByIndex: Record<number, GramJs.InputSingleMedia>;
}> = {};

function sendGroupedMedia(
  {
    chat,
    text,
    entities,
    replyingTo,
    replyingToTopId,
    attachment,
    groupedId,
    isSilent,
    scheduledAt,
    sendAs,
  }: {
    chat: ApiChat;
    text?: string;
    entities?: ApiMessageEntity[];
    replyingTo?: number;
    replyingToTopId?: number;
    attachment: ApiAttachment;
    groupedId: string;
    isSilent?: boolean;
    scheduledAt?: number;
    sendAs?: ApiUser | ApiChat;
  },
  randomId: GramJs.long,
  localMessage: ApiMessage,
  onProgress?: ApiOnProgress,
) {
  let groupIndex = -1;
  if (!groupedUploads[groupedId]) {
    groupedUploads[groupedId] = {
      counter: 0,
      singleMediaByIndex: {},
    };
  }

  groupIndex = groupedUploads[groupedId].counter++;

  const prevQueue = queue;
  queue = (async () => {
    let media;
    try {
      media = await uploadMedia(localMessage, attachment, onProgress!);
    } catch (err) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.warn(err);
      }

      groupedUploads[groupedId].counter--;

      await prevQueue;

      return;
    }

    // const inputMedia = await fetchInputMedia(
    //   buildInputPeer(chat.id, chat.accessHash),
    //   media as GramJs.InputMediaUploadedPhoto | GramJs.InputMediaUploadedDocument,
    // );

    await prevQueue;

    // if (!inputMedia) {
    //   groupedUploads[groupedId].counter--;
    //
    //   if (DEBUG) {
    //     // eslint-disable-next-line no-console
    //     console.warn('Failed to upload grouped media');
    //   }
    //
    //   return;
    // }

    // groupedUploads[groupedId].singleMediaByIndex[groupIndex] = new GramJs.InputSingleMedia({
    //   media: inputMedia,
    //   randomId,
    //   message: text || '',
    //   entities: entities ? entities.map(buildMtpMessageEntity) : undefined,
    // });
    //
    // if (Object.keys(groupedUploads[groupedId].singleMediaByIndex).length < groupedUploads[groupedId].counter) {
    //   return;
    // }

    // const { singleMediaByIndex } = groupedUploads[groupedId];
    delete groupedUploads[groupedId];
    if (onProgress) {
      let fileId: string | undefined;
      //@ts-ignore
      if(media && media!.file && media.file.id) {
        //@ts-ignore
        fileId = media!.file.id.toString()
      }

      if(localMessage.content.photo || localMessage.content.document){

        const getPhotoInfo = async (attachment:ApiAttachment)=>{
          const dataUri = await blobToDataUri(await fetchBlob(attachment.thumbBlobUrl! ));
          const size = {
            "width": attachment.quick!.width,
            "height":  attachment.quick!.height,
          }
          return{
            dataUri,size
          }
        }

        if(localMessage.content.document){
          localMessage.content.document.id = fileId

          if(localMessage.content.document.mimeType.split("/")[0] === "image"){
            const {size,dataUri} = await getPhotoInfo(attachment);
            localMessage.content.document.mediaType = "photo";
            localMessage.content.document.previewBlobUrl = undefined;
            localMessage.content.document.thumbnail = {
              ...size,
              dataUri
            }
            localMessage.content.document.mediaSize = size;
          }
        }

        if(localMessage.content.photo){
          const {size,dataUri} = await getPhotoInfo(attachment);
          localMessage.content.photo = {
            isSpoiler:localMessage.content.photo.isSpoiler,
            id:fileId!,
            "thumbnail": {
              ...size,
              dataUri
            },
            "sizes": [
              {
                ...size,
                "type": "y"
              }
            ],
          }
        }
      }

      await onProgress(2, localMessage)
    }
    // await invokeRequest(new GramJs.messages.SendMultiMedia({
    //   clearDraft: true,
    //   peer: buildInputPeer(chat.id, chat.accessHash),
    //   multiMedia: Object.values(singleMediaByIndex), // Object keys are usually ordered
    //   replyToMsgId: replyingTo,
    //   ...(replyingToTopId && { topMsgId: replyingToTopId }),
    //   ...(isSilent && { silent: isSilent }),
    //   ...(scheduledAt && { scheduleDate: scheduledAt }),
    //   ...(sendAs && { sendAs: buildInputPeer(sendAs.id, sendAs.accessHash) }),
    // }), true);
  })();

  return queue;
}

async function fetchInputMedia(
  peer: GramJs.TypeInputPeer,
  uploadedMedia: GramJs.InputMediaUploadedPhoto | GramJs.InputMediaUploadedDocument,
) {
  const messageMedia = await invokeRequest(new GramJs.messages.UploadMedia({
    peer,
    media: uploadedMedia,
  }));
  const isSpoiler = uploadedMedia.spoiler;

  if ((
    messageMedia instanceof GramJs.MessageMediaPhoto
    && messageMedia.photo
    && messageMedia.photo instanceof GramJs.Photo)
  ) {
    const { photo: { id, accessHash, fileReference } } = messageMedia;

    return new GramJs.InputMediaPhoto({
      id: new GramJs.InputPhoto({ id, accessHash, fileReference }),
      spoiler: isSpoiler,
    });
  }

  if ((
    messageMedia instanceof GramJs.MessageMediaDocument
    && messageMedia.document
    && messageMedia.document instanceof GramJs.Document)
  ) {
    const { document: { id, accessHash, fileReference } } = messageMedia;

    return new GramJs.InputMediaDocument({
      id: new GramJs.InputDocument({ id, accessHash, fileReference }),
      spoiler: isSpoiler,
    });
  }

  return undefined;
}

export async function editMessage({
  chat,
  message,
  text,
  entities,
  noWebPage,
}: {
  chat: ApiChat;
  message: ApiMessage;
  text: string;
  entities?: ApiMessageEntity[];
  noWebPage?: boolean;
}) {
  const isScheduled = message.date * 1000 > Date.now() + getServerTimeOffset() * 1000;
  let messageUpdate: Partial<ApiMessage> = {
    content: {
      ...message.content,
      ...(text && {
        text: {
          text,
          entities,
        },
      }),
    },
  };

  const emojiOnlyCount = getEmojiOnlyCountForMessage(messageUpdate.content!, messageUpdate.groupedId);
  messageUpdate = {
    ...messageUpdate,
    emojiOnlyCount,
  };
  onUpdate({
    '@type': isScheduled ? 'updateScheduledMessage' : 'updateMessage',
    id: message.id,
    chatId: chat.id,
    message: messageUpdate,
  });

  // TODO Revise intersecting with scheduled
  localDb.localMessages[message.id] = { ...message, ...messageUpdate };

  const mtpEntities = entities && entities.map(buildMtpMessageEntity);

  // await invokeRequest(new GramJs.messages.EditMessage({
  //   message: text || '',
  //   entities: mtpEntities,
  //   peer: buildInputPeer(chat.id, chat.accessHash),
  //   id: message.id,
  //   ...(isScheduled && { scheduleDate: message.date }),
  //   ...(noWebPage && { noWebpage: noWebPage }),
  // }), true);
  // await Account.getCurrentAccount()!.sendPdu(new MsgUpdateReq({
  //   msg_id:message.id,
  //   chat_id:chat.id,
  //   user_id:Account.getCurrentAccount()?.getUid()!,
  //   text
  // }).pack(),0)
}

export async function rescheduleMessage({
  chat,
  message,
  scheduledAt,
}: {
  chat: ApiChat;
  message: ApiMessage;
  scheduledAt: number;
}) {
  await invokeRequest(new GramJs.messages.EditMessage({
    peer: buildInputPeer(chat.id, chat.accessHash),
    id: message.id,
    scheduleDate: scheduledAt,
  }), true);
}

async function uploadMedia(localMessage: ApiMessage, attachment: ApiAttachment, onProgress: ApiOnProgress) {
  const {
    filename, blobUrl, encryptUrl,mimeType, quick, voice, audio, previewBlobUrl, shouldSendAsFile, shouldSendAsSpoiler,
  } = attachment;

  const patchedOnProgress: ApiOnProgress = (progress) => {
    if (onProgress.isCanceled) {
      patchedOnProgress.isCanceled = true;
    } else {
      onProgress(progress, localMessage);
    }
  };

  let file;
  if(encryptUrl){
    file = await fetchFile(encryptUrl, "EN_"+filename);
  }else{
    file = await fetchFile(blobUrl, filename);
  }
  const inputFile = await uploadFileV1({file, onProgress:patchedOnProgress,workers: UPLOAD_WORKERS});
  // const thumbFile = previewBlobUrl && await fetchFile(previewBlobUrl, filename);
  //const thumb = thumbFile ? await uploadFileV1({file:thumbFile,workers: UPLOAD_WORKERS}) : undefined;
  const thumb = undefined;
  const attributes: GramJs.TypeDocumentAttribute[] = [new GramJs.DocumentAttributeFilename({ fileName: filename })];
  if (!shouldSendAsFile) {
    if (quick) {
      if (SUPPORTED_IMAGE_CONTENT_TYPES.has(mimeType) && mimeType !== GIF_MIME_TYPE) {
        return new GramJs.InputMediaUploadedPhoto({
          file: inputFile,
          spoiler: shouldSendAsSpoiler,
        });
      }

      if (SUPPORTED_VIDEO_CONTENT_TYPES.has(mimeType)) {
        const { width, height, duration } = quick;
        if (duration !== undefined) {
          attributes.push(new GramJs.DocumentAttributeVideo({
            duration,
            w: width,
            h: height,
            supportsStreaming: true,
          }));
        }
      }
    }

    if (audio) {
      const { duration, title, performer } = audio;
      attributes.push(new GramJs.DocumentAttributeAudio({
        duration,
        title,
        performer,
      }));
    }

    if (voice) {
      const { duration, waveform } = voice;
      const { data: inputWaveform } = interpolateArray(waveform, INPUT_WAVEFORM_LENGTH);
      attributes.push(new GramJs.DocumentAttributeAudio({
        voice: true,
        duration,
        waveform: Buffer.from(inputWaveform),
      }));
    }
  }

  return new GramJs.InputMediaUploadedDocument({
    file: inputFile,
    mimeType,
    attributes,
    thumb,
    forceFile: shouldSendAsFile,
    spoiler: shouldSendAsSpoiler,
  });
}

export async function pinMessage({
  chat, messageId, isUnpin, isOneSide, isSilent,
}: { chat: ApiChat; messageId: number; isUnpin: boolean; isOneSide?: boolean; isSilent?: boolean }) {
  await invokeRequest(new GramJs.messages.UpdatePinnedMessage({
    peer: buildInputPeer(chat.id, chat.accessHash),
    id: messageId,
    ...(isUnpin && { unpin: true }),
    ...(isOneSide && { pmOneside: true }),
    ...(isSilent && { silent: true }),
  }), true);
}

export async function unpinAllMessages({ chat, threadId }: { chat: ApiChat; threadId?: number }) {
  await invokeRequest(new GramJs.messages.UnpinAllMessages({
    peer: buildInputPeer(chat.id, chat.accessHash),
    ...(threadId && { topMsgId: threadId }),
  }), true);
}

export async function deleteMessages({
  chat, messageIds, shouldDeleteForAll,
}: {
  chat: ApiChat; messageIds: number[]; shouldDeleteForAll?: boolean;
}) {
  const isChannel = getEntityTypeById(chat.id) === 'channel';

  // await Account.getCurrentAccount()?.sendPduWithCallback(new MsgDeleteReq({
  //   msg_ids:messageIds,
  //   chat_id:chat.id,
  //   user_id:Account.getCurrentAccount()?.getUid()!,
  //   revoke: shouldDeleteForAll
  // }).pack())

  // const result = await invokeRequest(
  //   isChannel
  //     ? new GramJs.channels.DeleteMessages({
  //       channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
  //       id: messageIds,
  //     })
  //     : new GramJs.messages.DeleteMessages({
  //       id: messageIds,
  //       ...(shouldDeleteForAll && { revoke: true }),
  //     }),
  // );
  //
  // if (!result) {
  //   return;
  // }
  onUpdate({
    '@type': 'deleteMessages',
    ids: messageIds,
    ...{ chatId: chat.id },
    ...(isChannel && { chatId: chat.id }),
  });
}

export async function deleteScheduledMessages({
  chat, messageIds,
}: {
  chat: ApiChat; messageIds: number[];
}) {
  const result = await invokeRequest(
    new GramJs.messages.DeleteScheduledMessages({
      peer: buildInputPeer(chat.id, chat.accessHash),
      id: messageIds,
    }),
  );

  if (!result) {
    return;
  }

  onUpdate({
    '@type': 'deleteScheduledMessages',
    ids: messageIds,
    chatId: chat.id,
  });
}

export async function deleteHistory({
  chat, shouldDeleteForAll,
}: {
  chat: ApiChat; shouldDeleteForAll?: boolean; maxId?: number;
}) {
  const isChannel = getEntityTypeById(chat.id) === 'channel';
  const result = await invokeRequest(
    isChannel
      ? new GramJs.channels.DeleteHistory({
        channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
      })
      : new GramJs.messages.DeleteHistory({
        peer: buildInputPeer(chat.id, chat.accessHash),
        ...(shouldDeleteForAll && { revoke: true }),
        ...(!shouldDeleteForAll && { just_clear: true }),
      }),
  );

  if (!result) {
    return;
  }

  if ('offset' in result && result.offset) {
    await deleteHistory({ chat, shouldDeleteForAll });
    return;
  }

  onUpdate({
    '@type': 'deleteHistory',
    chatId: chat.id,
  });
}

export async function reportMessages({
  peer, messageIds, reason, description,
}: {
  peer: ApiChat | ApiUser; messageIds: number[]; reason: ApiReportReason; description?: string;
}) {
  const result = await invokeRequest(new GramJs.messages.Report({
    peer: buildInputPeer(peer.id, peer.accessHash),
    id: messageIds,
    reason: buildInputReportReason(reason),
    message: description,
  }));

  return result;
}

export async function sendMessageAction({
  peer, threadId, action,
}: {
  peer: ApiChat | ApiUser; threadId?: number; action: ApiSendMessageAction;
}) {
  const gramAction = buildSendMessageAction(action);
  if (!gramAction) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('Unsupported message action', action);
    }
    return undefined;
  }

  try {
    const result = await invokeRequest(new GramJs.messages.SetTyping({
      peer: buildInputPeer(peer.id, peer.accessHash),
      topMsgId: threadId,
      action: gramAction,
    }), undefined, true);
    return result;
  } catch (error) {
    // Prevent error from being displayed in UI
  }
  return undefined;
}

export async function markMessageListRead({
  chat, threadId, maxId = -1,
}: {
  chat: ApiChat; threadId: number; maxId?: number;
}) {
  const isChannel = getEntityTypeById(chat.id) === 'channel';

  // Workaround for local message IDs overflowing some internal `Buffer` range check
  const fixedMaxId = Math.min(maxId, MAX_INT_32);
  if (isChannel && threadId === MAIN_THREAD_ID) {
    await invokeRequest(new GramJs.channels.ReadHistory({
      channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
      maxId: fixedMaxId,
    }));
  } else if (isChannel) {
    await invokeRequest(new GramJs.messages.ReadDiscussion({
      peer: buildInputPeer(chat.id, chat.accessHash),
      msgId: threadId,
      readMaxId: fixedMaxId,
    }));
  } else {
    await invokeRequest(new GramJs.messages.ReadHistory({
      peer: buildInputPeer(chat.id, chat.accessHash),
      maxId: fixedMaxId,
    }));
  }

  if (threadId === MAIN_THREAD_ID) {
    void requestChatUpdate({ chat, noLastMessage: true });
  } else {
    void requestThreadInfoUpdate({ chat, threadId });
  }
}

export async function markMessagesRead({
  chat, messageIds,
}: {
  chat: ApiChat; messageIds: number[];
}) {
  const isChannel = getEntityTypeById(chat.id) === 'channel';

  await invokeRequest(
    isChannel
      ? new GramJs.channels.ReadMessageContents({
        channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
        id: messageIds,
      })
      : new GramJs.messages.ReadMessageContents({
        id: messageIds,
      }),
  );

  onUpdate({
    ...(isChannel ? {
      '@type': 'updateChannelMessages',
      channelId: chat.id,
    } : {
      '@type': 'updateCommonBoxMessages',
    }),
    ids: messageIds,
    messageUpdate: {
      hasUnreadMention: false,
      isMediaUnread: false,
    },
  });
}

export async function fetchMessageViews({
  chat, ids,
}: {
  chat: ApiChat; ids: number[];
}) {
  const result = await invokeRequest(new GramJs.messages.GetMessagesViews({
    peer: buildInputPeer(chat.id, chat.accessHash),
    id: ids,
    increment: false,
  }));

  if (!result) return undefined;

  return ids.map((id, index) => {
    const { views, forwards, replies } = result.views[index];
    return {
      id,
      views,
      forwards,
      messagesCount: replies?.replies,
    };
  });
}

export async function requestThreadInfoUpdate({
  chat, threadId, originChannelId,
}: {
  chat: ApiChat; threadId: number; originChannelId?: string;
}) {
  if (threadId === MAIN_THREAD_ID) {
    return undefined;
  }

  const [topMessageResult, repliesResult] = await Promise.all([
    invokeRequest(new GramJs.messages.GetDiscussionMessage({
      peer: buildInputPeer(chat.id, chat.accessHash),
      msgId: Number(threadId),
    })),
    invokeRequest(new GramJs.messages.GetReplies({
      peer: buildInputPeer(chat.id, chat.accessHash),
      msgId: Number(threadId),
      offsetId: 1,
      addOffset: -1,
      limit: 1,
    })),
  ]);

  if (!topMessageResult || !topMessageResult.messages.length) {
    return undefined;
  }

  const discussionChatId = resolveMessageApiChatId(topMessageResult.messages[0]);
  if (!discussionChatId) {
    return undefined;
  }

  const topMessageId = topMessageResult.messages[topMessageResult.messages.length - 1].id;

  onUpdate({
    '@type': 'updateThreadInfo',
    chatId: discussionChatId,
    threadId: topMessageId,
    threadInfo: {
      threadId: topMessageId,
      topMessageId,
      lastReadInboxMessageId: topMessageResult.readInboxMaxId,
      messagesCount: (repliesResult instanceof GramJs.messages.ChannelMessages) ? repliesResult.count : undefined,
      lastMessageId: topMessageResult.maxId,
      ...(originChannelId ? { originChannelId } : undefined),
    },
    firstMessageId: repliesResult && 'messages' in repliesResult && repliesResult.messages.length
      ? repliesResult.messages[0].id
      : undefined,
  });

  const chats = topMessageResult.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);
  chats.forEach((newChat) => {
    onUpdate({
      '@type': 'updateChat',
      id: newChat.id,
      chat: newChat,
      noTopChatsRequest: true,
    });
  });

  if (chat.isForum) {
    onUpdate({
      '@type': 'updateTopic',
      chatId: chat.id,
      topicId: threadId,
    });
  }

  addEntitiesWithPhotosToLocalDb(topMessageResult.users);
  addEntitiesWithPhotosToLocalDb(topMessageResult.chats);

  const users = topMessageResult.users.map(buildApiUser).filter(Boolean);

  return {
    topMessageId,
    discussionChatId,
    users,
  };
}

export async function searchMessagesLocal({
  chat, type, query, topMessageId, minDate, maxDate, ...pagination
}: {
  chat: ApiChat;
  type?: ApiMessageSearchType | ApiGlobalMessageSearchType;
  query?: string;
  topMessageId?: number;
  offsetId?: number;
  addOffset?: number;
  limit: number;
  minDate?: number;
  maxDate?: number;
}) {
  let filter;
  switch (type) {
    case 'media':
      filter = new GramJs.InputMessagesFilterPhotoVideo();
      break;
    case 'documents':
      filter = new GramJs.InputMessagesFilterDocument();
      break;
    case 'links':
      filter = new GramJs.InputMessagesFilterUrl();
      break;
    case 'audio':
      filter = new GramJs.InputMessagesFilterMusic();
      break;
    case 'voice':
      filter = new GramJs.InputMessagesFilterRoundVoice();
      break;
    case 'profilePhoto':
      filter = new GramJs.InputMessagesFilterChatPhotos();
      break;
    case 'text':
    default: {
      filter = new GramJs.InputMessagesFilterEmpty();
    }
  }

  const result = await invokeRequest(new GramJs.messages.Search({
    peer: buildInputPeer(chat.id, chat.accessHash),
    topMsgId: topMessageId,
    filter,
    q: query || '',
    minDate,
    maxDate,
    ...pagination,
  }));

  if (
    !result
    || result instanceof GramJs.messages.MessagesNotModified
    || !result.messages
  ) {
    return undefined;
  }

  updateLocalDb(result);

  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);
  const users = result.users.map(buildApiUser).filter(Boolean);
  const messages = result.messages.map(buildApiMessage).filter(Boolean);

  let totalCount = messages.length;
  let nextOffsetId: number | undefined;
  if (result instanceof GramJs.messages.MessagesSlice || result instanceof GramJs.messages.ChannelMessages) {
    totalCount = result.count;

    if (messages.length) {
      nextOffsetId = messages[messages.length - 1].id;
    }
  }

  return {
    chats,
    users,
    messages,
    totalCount,
    nextOffsetId,
  };
}

export async function searchMessagesGlobal({
  query, offsetRate = 0, limit, type = 'text', minDate, maxDate,
}: {
  query: string;
  offsetRate?: number;
  limit: number;
  type?: ApiGlobalMessageSearchType;
  minDate?: number;
  maxDate?: number;
}) {
  let filter;
  switch (type) {
    case 'media':
      filter = new GramJs.InputMessagesFilterPhotoVideo();
      break;
    case 'documents':
      filter = new GramJs.InputMessagesFilterDocument();
      break;
    case 'links':
      filter = new GramJs.InputMessagesFilterUrl();
      break;
    case 'audio':
      filter = new GramJs.InputMessagesFilterMusic();
      break;
    case 'voice':
      filter = new GramJs.InputMessagesFilterRoundVoice();
      break;
    case 'text':
    default: {
      if (!query && !(maxDate && minDate)) {
        return undefined;
      }

      filter = new GramJs.InputMessagesFilterEmpty();
    }
  }

  const result = await invokeRequest(new GramJs.messages.SearchGlobal({
    q: query,
    offsetRate,
    offsetPeer: new GramJs.InputPeerEmpty(),
    limit,
    filter,
    folderId: ALL_FOLDER_ID,
    minDate,
    maxDate,
  }));

  if (
    !result
    || result instanceof GramJs.messages.MessagesNotModified
    || !result.messages
  ) {
    return undefined;
  }

  updateLocalDb({
    chats: result.chats,
    users: result.users,
    messages: result.messages,
  } as GramJs.messages.Messages);

  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);
  const users = result.users.map(buildApiUser).filter(Boolean);
  const messages = result.messages.map(buildApiMessage).filter(Boolean);

  let totalCount = messages.length;
  let nextRate: number | undefined;
  if (result instanceof GramJs.messages.MessagesSlice || result instanceof GramJs.messages.ChannelMessages) {
    totalCount = result.count;

    if (messages.length) {
      nextRate = messages[messages.length - 1].id;
    }
  }

  return {
    messages,
    users,
    chats,
    totalCount,
    nextRate: 'nextRate' in result && result.nextRate ? result.nextRate : nextRate,
  };
}

export async function fetchWebPagePreview({ message }: { message: string }) {
  const preview = await invokeRequest(new GramJs.messages.GetWebPagePreview({
    message,
  }));

  return preview && buildWebPage(preview);
}

export async function sendPollVote({
  chat, messageId, options,
}: {
  chat: ApiChat;
  messageId: number;
  options: string[];
}) {
  const { id, accessHash } = chat;

  await invokeRequest(new GramJs.messages.SendVote({
    peer: buildInputPeer(id, accessHash),
    msgId: messageId,
    options: options.map(deserializeBytes),
  }), true);
}

export async function closePoll({
  chat, messageId, poll,
}: {
  chat: ApiChat;
  messageId: number;
  poll: ApiPoll;
}) {
  const { id, accessHash } = chat;

  await invokeRequest(new GramJs.messages.EditMessage({
    peer: buildInputPeer(id, accessHash),
    id: messageId,
    media: buildInputPollFromExisting(poll, true),
  }));
}

export async function loadPollOptionResults({
  chat, messageId, option, offset, limit, shouldResetVoters,
}: {
  chat: ApiChat;
  messageId: number;
  option?: string;
  offset?: string;
  limit?: number;
  shouldResetVoters?: boolean;
}) {
  const { id, accessHash } = chat;

  const result = await invokeRequest(new GramJs.messages.GetPollVotes({
    peer: buildInputPeer(id, accessHash),
    id: messageId,
    ...(option && { option: deserializeBytes(option) }),
    ...(offset && { offset }),
    ...(limit && { limit }),
  }));

  if (!result) {
    return undefined;
  }

  updateLocalDb({
    chats: [] as GramJs.TypeChat[],
    users: result.users,
    messages: [] as GramJs.Message[],
  } as GramJs.messages.Messages);

  const users = result.users.map(buildApiUser).filter(Boolean);
  const votes = result.votes.map((vote) => ({
    userId: vote.userId,
    date: vote.date,
  }));

  return {
    count: result.count,
    votes,
    users,
    nextOffset: result.nextOffset,
    shouldResetVoters,
  };
}

export async function fetchExtendedMedia({
  chat, ids,
}: {
  chat: ApiChat;
  ids: number[];
}) {
  await invokeRequest(new GramJs.messages.GetExtendedMedia({
    peer: buildInputPeer(chat.id, chat.accessHash),
    id: ids,
  }));
}

export async function forwardMessages({
  fromChat,
  toChat,
  toThreadId,
  messages,
  isSilent,
  scheduledAt,
  sendAs,
  withMyScore,
  noAuthors,
  noCaptions,
  isCurrentUserPremium,
}: {
  fromChat: ApiChat;
  toChat: ApiChat;
  toThreadId?: number;
  messages: ApiMessage[];
  isSilent?: boolean;
  scheduledAt?: number;
  sendAs?: ApiUser | ApiChat;
  withMyScore?: boolean;
  noAuthors?: boolean;
  noCaptions?: boolean;
  isCurrentUserPremium?: boolean;
}) {
  const messageIds = messages.map(({ id }) => id);
  const randomIds = messages.map(generateRandomBigInt);

  messages.forEach((message, index) => {
    const localMessage = buildLocalForwardedMessage({
      toChat,
      toThreadId,
      message,
      scheduledAt,
      noAuthors,
      noCaptions,
      isCurrentUserPremium,
    });

    localDb.localMessages[String(randomIds[index])] = localMessage;

    onUpdate({
      '@type': localMessage.isScheduled ? 'newScheduledMessage' : 'newMessage',
      id: localMessage.id,
      chatId: toChat.id,
      message: localMessage,
    });
  });

  //
  // await invokeRequest(new GramJs.messages.ForwardMessages({
  //   fromPeer: buildInputPeer(fromChat.id, fromChat.accessHash),
  //   toPeer: buildInputPeer(toChat.id, toChat.accessHash),
  //   randomId: randomIds,
  //   id: messageIds,
  //   withMyScore: withMyScore || undefined,
  //   silent: isSilent || undefined,
  //   dropAuthor: noAuthors || undefined,
  //   dropMediaCaptions: noCaptions || undefined,
  //   ...(toThreadId && { topMsgId: toThreadId }),
  //   ...(scheduledAt && { scheduleDate: scheduledAt }),
  //   ...(sendAs && { sendAs: buildInputPeer(sendAs.id, sendAs.accessHash) }),
  // }), true);
}

export async function findFirstMessageIdAfterDate({
  chat,
  timestamp,
}: {
  chat: ApiChat;
  timestamp: number;
}) {
  const result = await invokeRequest(new GramJs.messages.GetHistory({
    peer: buildInputPeer(chat.id, chat.accessHash),
    offsetDate: timestamp,
    addOffset: -1,
    limit: 1,
  }));

  if (
    !result
    || result instanceof GramJs.messages.MessagesNotModified
    || !result.messages || !result.messages.length
  ) {
    return undefined;
  }

  return result.messages[0].id;
}

export async function fetchScheduledHistory({ chat }: { chat: ApiChat }) {
  const { id, accessHash } = chat;

  const result = await invokeRequest(new GramJs.messages.GetScheduledHistory({
    peer: buildInputPeer(id, accessHash),
  }));

  if (
    !result
    || result instanceof GramJs.messages.MessagesNotModified
    || !result.messages
  ) {
    return undefined;
  }

  updateLocalDb(result);

  const messages = result.messages.map(buildApiMessage).filter(Boolean);

  return {
    messages,
  };
}

export async function sendScheduledMessages({ chat, ids }: { chat: ApiChat; ids: number[] }) {
  const { id, accessHash } = chat;

  await invokeRequest(new GramJs.messages.SendScheduledMessages({
    peer: buildInputPeer(id, accessHash),
    id: ids,
  }), true);
}

function updateLocalDb(result: (
  GramJs.messages.MessagesSlice | GramJs.messages.Messages | GramJs.messages.ChannelMessages |
  GramJs.messages.DiscussionMessage | GramJs.messages.SponsoredMessages
)) {
  addEntitiesWithPhotosToLocalDb(result.users);
  addEntitiesWithPhotosToLocalDb(result.chats);

  result.messages.forEach((message) => {
    if ((message instanceof GramJs.Message && isMessageWithMedia(message))
      || (message instanceof GramJs.MessageService && isServiceMessageWithMedia(message))
    ) {
      addMessageToLocalDb(message);
    }
  });
}

export async function fetchPinnedMessages({ chat, threadId }: { chat: ApiChat; threadId: number }) {
  const result = await invokeRequest(new GramJs.messages.Search(
    {
      peer: buildInputPeer(chat.id, chat.accessHash),
      filter: new GramJs.InputMessagesFilterPinned(),
      q: '',
      limit: PINNED_MESSAGES_LIMIT,
      topMsgId: threadId,
    },
  ));

  if (
    !result
    || result instanceof GramJs.messages.MessagesNotModified
    || !result.messages
  ) {
    return undefined;
  }

  updateLocalDb(result);

  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);
  const users = result.users.map(buildApiUser).filter(Boolean);
  const messages = result.messages.map(buildApiMessage).filter(Boolean);

  return {
    messages,
    users,
    chats,
  };
}

export async function fetchSeenBy({ chat, messageId }: { chat: ApiChat; messageId: number }) {
  const result = await invokeRequest(new GramJs.messages.GetMessageReadParticipants({
    peer: buildInputPeer(chat.id, chat.accessHash),
    msgId: messageId,
  }));

  return result ? result.map(String) : undefined;
}

export async function fetchSendAs({
  chat,
}: {
  chat: ApiChat;
}) {
  const result = await invokeRequest(new GramJs.channels.GetSendAs({
    peer: buildInputPeer(chat.id, chat.accessHash),
  }), undefined, undefined, undefined, undefined, true);

  if (!result) {
    return undefined;
  }

  addEntitiesWithPhotosToLocalDb(result.users);
  addEntitiesWithPhotosToLocalDb(result.chats);

  const users = result.users.map(buildApiUser).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);

  return {
    users,
    chats,
    sendAs: result.peers.map(buildApiSendAsPeerId),
  };
}

export function saveDefaultSendAs({
  sendAs, chat,
}: {
  sendAs: ApiChat | ApiUser; chat: ApiChat;
}) {
  return invokeRequest(new GramJs.messages.SaveDefaultSendAs({
    peer: buildInputPeer(chat.id, chat.accessHash),
    sendAs: buildInputPeer(sendAs.id, sendAs.accessHash),
  }));
}

export async function fetchSponsoredMessages({ chat }: { chat: ApiChat }) {
  const result = await invokeRequest(new GramJs.channels.GetSponsoredMessages({
    channel: buildInputPeer(chat.id, chat.accessHash),
  }));

  if (!result || result instanceof GramJs.messages.SponsoredMessagesEmpty || !result.messages.length) {
    return undefined;
  }

  updateLocalDb(result);

  const messages = result.messages.map(buildApiSponsoredMessage).filter(Boolean);
  const users = result.users.map(buildApiUser).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);

  return {
    messages,
    users,
    chats,
  };
}

export async function viewSponsoredMessage({ chat, random }: { chat: ApiChat; random: string }) {
  await invokeRequest(new GramJs.channels.ViewSponsoredMessage({
    channel: buildInputPeer(chat.id, chat.accessHash),
    randomId: deserializeBytes(random),
  }));
}

export function readAllMentions({
  chat,
}: {
  chat: ApiChat;
}) {
  return invokeRequest(new GramJs.messages.ReadMentions({
    peer: buildInputPeer(chat.id, chat.accessHash),
  }), true);
}

export function readAllReactions({
  chat,
}: {
  chat: ApiChat;
}) {
  return invokeRequest(new GramJs.messages.ReadReactions({
    peer: buildInputPeer(chat.id, chat.accessHash),
  }), true);
}

export async function fetchUnreadMentions({
  chat, ...pagination
}: {
  chat: ApiChat;
  offsetId?: number;
  addOffset?: number;
  maxId?: number;
  minId?: number;
}) {
  const result = await invokeRequest(new GramJs.messages.GetUnreadMentions({
    peer: buildInputPeer(chat.id, chat.accessHash),
    limit: MENTION_UNREAD_SLICE,
    ...pagination,
  }));

  if (
    !result
    || result instanceof GramJs.messages.MessagesNotModified
    || !result.messages
  ) {
    return undefined;
  }

  updateLocalDb(result);

  const messages = result.messages.map(buildApiMessage).filter(Boolean);
  const users = result.users.map(buildApiUser).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);

  return {
    messages,
    users,
    chats,
  };
}

export async function fetchUnreadReactions({
  chat, ...pagination
}: {
  chat: ApiChat;
  offsetId?: number;
  addOffset?: number;
  maxId?: number;
  minId?: number;
}) {
  const result = await invokeRequest(new GramJs.messages.GetUnreadReactions({
    peer: buildInputPeer(chat.id, chat.accessHash),
    limit: REACTION_UNREAD_SLICE,
    ...pagination,
  }));

  if (
    !result
    || result instanceof GramJs.messages.MessagesNotModified
    || !result.messages
  ) {
    return undefined;
  }

  updateLocalDb(result);

  const messages = result.messages.map(buildApiMessage).filter(Boolean);
  const users = result.users.map(buildApiUser).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);

  return {
    messages,
    users,
    chats,
  };
}

export async function transcribeAudio({
  chat, messageId,
}: {
  chat: ApiChat; messageId: number;
}) {
  const result = await invokeRequest(new GramJs.messages.TranscribeAudio({
    msgId: messageId,
    peer: buildInputPeer(chat.id, chat.accessHash),
  }));

  if (!result) return undefined;

  onUpdate({
    '@type': 'updateTranscribedAudio',
    isPending: result.pending,
    transcriptionId: result.transcriptionId.toString(),
    text: result.text,
  });

  return result.transcriptionId.toString();
}

export async function translateText(params: TranslateTextParams) {
  let result;
  const isMessageTranslation = 'chat' in params;
  if (isMessageTranslation) {
    const { chat, messageIds, toLanguageCode } = params;
    result = await invokeRequest(new GramJs.messages.TranslateText({
      peer: buildInputPeer(chat.id, chat.accessHash),
      id: messageIds,
      toLang: toLanguageCode,
    }));
  } else {
    const { text, toLanguageCode } = params;
    result = await invokeRequest(new GramJs.messages.TranslateText({
      text: text.map((t) => buildInputTextWithEntities(t)),
      toLang: toLanguageCode,
    }));
  }

  if (!result) return undefined;

  const formattedText = result.result.map((r) => buildApiFormattedText(r));

  if (isMessageTranslation) {
    onUpdate({
      '@type': 'updateMessageTranslations',
      chatId: params.chat.id,
      messageIds: params.messageIds,
      translations: formattedText,
      toLanguageCode: params.toLanguageCode,
    });
  }

  return formattedText;
}
