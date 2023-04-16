import {Api as GramJs, connection, TelegramClient,} from '../../../lib/gramjs';

import {Logger as GramJsLogger} from '../../../lib/gramjs/extensions/index';
import type {TwoFaParams} from '../../../lib/gramjs/client/2fa';

import type {
  AccountSession,
  ApiInitialArgs,
  ApiMediaFormat,
  ApiOnProgress,
  ApiSessionData,
  OnApiUpdate,
} from '../../types';

import {APP_VERSION, CLOUD_MESSAGE_API, DEBUG, DEBUG_GRAMJS, UPLOAD_WORKERS,} from '../../../config';
import {onCurrentUserUpdate,} from './auth';
import {updater} from '../updater';
import {setMessageBuilderCurrentUserId} from '../apiBuilders/messages';
import downloadMediaWithClient, {parseMediaUrl} from './media';
import {buildApiUserFromFull} from '../apiBuilders/users';
import localDb, {clearLocalDb} from '../localDb';
import {buildApiPeerId} from '../apiBuilders/peers';
import {addMessageToLocalDb, log} from '../helpers';
import {Pdu} from "../../../lib/ptp/protobuf/BaseMsg";
import Account from "../../../worker/share/Account";
import LocalDatabase from "../../../worker/share/db/LocalDatabase";
import {ActionCommands, getActionCommandsName} from "../../../lib/ptp/protobuf/ActionCommands";
import {CurrentUserInfo} from "../../../worker/setting";
import MsgWorker from "../../../worker/msg/MsgWorker";
import {AuthNativeReq} from "../../../lib/ptp/protobuf/PTPAuth";
import {ControllerPool} from "../../../lib/ptp/functions/requests";
import {StopChatStreamReq} from "../../../lib/ptp/protobuf/PTPOther";

const DEFAULT_USER_AGENT = 'Unknown UserAgent';
const DEFAULT_PLATFORM = 'Unknown platform';
const APP_CODE_NAME = 'Z';

GramJsLogger.setLevel(DEBUG_GRAMJS ? 'debug' : 'warn');

let onUpdate: OnApiUpdate;
let client: TelegramClient;
export let account: Account;
let isConnected = false;
let currentUserId: string | undefined;

export async function init(_onUpdate: OnApiUpdate, initialArgs: ApiInitialArgs) {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('>>> START INIT API');
  }
  onUpdate = _onUpdate;
  const {
    userAgent, platform, sessionData, isTest, isMovSupported, isWebmSupported, maxBufferSize, webAuthToken, dcId,
    mockScenario,accountId,entropy,session
  } = initialArgs;
  await handleAuthNative(accountId,entropy,session);
  if(DEBUG){
    console.log("[initialArgs]",{
      deviceModel: navigator.userAgent || userAgent || DEFAULT_USER_AGENT,
      systemVersion: platform || DEFAULT_PLATFORM,
      appVersion: `${APP_VERSION} ${APP_CODE_NAME}`,
      useWSS: true,
    })
  }
  try {
    if (DEBUG) {
      log('CONNECTING');
      // eslint-disable-next-line no-restricted-globals
      (self as any).invoke = invokeRequest;
    }

    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log('>>> FINISH INIT API');
      log('CONNECTED');
    }

    onUpdate({ '@type': 'updateApiReady' });

    onUpdate({
      '@type': 'updateAuthorizationState',
      authorizationState: "authorizationStateReady",
    });
    // @ts-ignore
    onUpdate({'@type': 'updateCurrentUser',currentUser: CurrentUserInfo});

    onUpdate({
      '@type': 'updateMsgClientState',
      msgClientState:"connectionStateLogged",
    });
    onUpdate({
      '@type': 'updateConnectionState',
      connectionState:"connectionStateReady",
    });
    // void fetchCurrentUser();
  } catch (err) {
    if (DEBUG) {
      log('CONNECTING ERROR', err);
    }
    throw err;
  }
}

export function setIsPremium({ isPremium }: { isPremium: boolean }) {
  // client.setIsPremium(isPremium);
}

export async function destroy(noLogOut = false, noClearLocalDb = false) {
  // if (!noLogOut) {
  //   await invokeRequest(new GramJs.auth.LogOut());
  // }
  if (!noClearLocalDb) clearLocalDb();

  await client.destroy();
}

export async function disconnect() {
  await client.disconnect();
}

export function getClient() {
  return client;

}

function onSessionUpdate(sessionData: ApiSessionData) {
  onUpdate({
    '@type': 'updateSession',
    sessionData,
  });
}

function handleGramJsUpdate(update: any) {
  if (update instanceof connection.UpdateConnectionState) {
    isConnected = update.state === connection.UpdateConnectionState.connected;
  } else if (update instanceof GramJs.UpdatesTooLong) {
    void handleTerminatedSession();
  } else if (update instanceof GramJs.UpdateConfig) {
    // eslint-disable-next-line no-underscore-dangle
    const currentUser = (update as GramJs.UpdateConfig & { _entities?: (GramJs.TypeUser | GramJs.TypeChat)[] })
      ._entities
      ?.find((entity) => entity instanceof GramJs.User && buildApiPeerId(entity.id, 'user') === currentUserId);
    if (!(currentUser instanceof GramJs.User)) return;

    setIsPremium({ isPremium: Boolean(currentUser.premium) });
  }
}

export async function invokeRequest<T extends GramJs.AnyRequest>(
  request: T,
  shouldReturnTrue: true,
  shouldThrow?: boolean,
  shouldIgnoreUpdates?: undefined,
  dcId?: number,
  shouldIgnoreErrors?: boolean,
): Promise<true | undefined>;

export async function invokeRequest<T extends GramJs.AnyRequest>(
  request: T,
  shouldReturnTrue?: boolean,
  shouldThrow?: boolean,
  shouldIgnoreUpdates?: boolean,
  dcId?: number,
  shouldIgnoreErrors?: boolean,
): Promise<T['__response'] | undefined>;

export async function invokeRequest<T extends GramJs.AnyRequest>(
  request: T,
  shouldReturnTrue = false,
  shouldThrow = false,
  shouldIgnoreUpdates = false,
  dcId?: number,
  shouldIgnoreErrors = false,
) {
  if (!isConnected) {
    if (DEBUG) {
      log('INVOKE ERROR', request.className, 'Client is not connected');
    }

    return undefined;
  }

  try {
    if (DEBUG) {
      log('INVOKE', request.className);
    }

    const result = await client.invoke(request, dcId);

    if (DEBUG) {
      log('RESPONSE', request.className, result);
    }

    if (!shouldIgnoreUpdates) {
      handleUpdatesFromRequest(request, result);
    }

    return shouldReturnTrue ? result && true : result;
  } catch (err: any) {
    if (shouldIgnoreErrors) return undefined;
    if (DEBUG) {
      log('INVOKE ERROR', request.className);
      // eslint-disable-next-line no-console
      console.debug('invokeRequest failed with payload', request);
      // eslint-disable-next-line no-console
      console.error(err);
    }

    if (shouldThrow) {
      throw err;
    }

    dispatchErrorUpdate(err, request);

    return undefined;
  }
}

function handleUpdatesFromRequest<T extends GramJs.AnyRequest>(request: T, result: T['__response']) {
  let manyUpdates;
  let singleUpdate;

  if (result instanceof GramJs.UpdatesCombined || result instanceof GramJs.Updates) {
    manyUpdates = result;
  } else if (typeof result === 'object' && 'updates' in result && (
    result.updates instanceof GramJs.Updates || result.updates instanceof GramJs.UpdatesCombined
  )) {
    manyUpdates = result.updates;
  } else if (
    result instanceof GramJs.UpdateShortMessage
    || result instanceof GramJs.UpdateShortChatMessage
    || result instanceof GramJs.UpdateShort
    || result instanceof GramJs.UpdateShortSentMessage
  ) {
    singleUpdate = result;
  }

  if (manyUpdates) {
    injectUpdateEntities(manyUpdates);

    manyUpdates.updates.forEach((update) => {
      updater(update, request);
    });
  } else if (singleUpdate) {
    updater(singleUpdate, request);
  }
}

export async function downloadMedia(
  args: { url: string; mediaFormat: ApiMediaFormat; start?: number; end?: number; isHtmlAllowed?: boolean },
  onProgress?: ApiOnProgress,
) {
  try {
    return (await downloadMediaWithClient(args, client, isConnected, onProgress));
  } catch (err: any) {
    if (err.message.startsWith('FILE_REFERENCE')) {
      const isFileReferenceRepaired = await repairFileReference({ url: args.url });
      if (isFileReferenceRepaired) {
        return downloadMediaWithClient(args, client, isConnected, onProgress);
      }

      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('Failed to repair file reference', args.url);
      }
    }

    throw err;
  }
}

export function uploadFile(file: File, onProgress?: ApiOnProgress) {
  return client.uploadFile({ file, onProgress, workers: UPLOAD_WORKERS });
}

export function updateTwoFaSettings(params: TwoFaParams) {
  return client.updateTwoFaSettings(params);
}

export function getTmpPassword(currentPassword: string, ttl?: number) {
  return client.getTmpPassword(currentPassword, ttl);
}

export async function fetchCurrentUser() {
  const userFull = await invokeRequest(new GramJs.users.GetFullUser({
    id: new GramJs.InputUserSelf(),
  }));

  if (!userFull || !(userFull.users[0] instanceof GramJs.User)) {
    return;
  }

  const user = userFull.users[0];

  if (user.photo instanceof GramJs.Photo) {
    localDb.photos[user.photo.id.toString()] = user.photo;
  }
  localDb.users[buildApiPeerId(user.id, 'user')] = user;
  const currentUser = buildApiUserFromFull(userFull);

  setMessageBuilderCurrentUserId(currentUser.id);
  onCurrentUserUpdate(currentUser);

  currentUserId = currentUser.id;
  setIsPremium({ isPremium: Boolean(currentUser.isPremium) });
}

export function dispatchErrorUpdate<T extends GramJs.AnyRequest>(err: Error, request: T) {
  const isSlowMode = err.message.startsWith('A wait of') && (
    request instanceof GramJs.messages.SendMessage
    || request instanceof GramJs.messages.SendMedia
    || request instanceof GramJs.messages.SendMultiMedia
  );

  const { message } = err;

  onUpdate({
    '@type': 'error',
    error: {
      message,
      isSlowMode,
      hasErrorKey: true,
    },
  });
}

function injectUpdateEntities(result: GramJs.Updates | GramJs.UpdatesCombined) {
  const entities = [...result.users, ...result.chats];

  result.updates.forEach((update) => {
    if (entities) {
      // eslint-disable-next-line no-underscore-dangle
      (update as any)._entities = entities;
    }
  });
}

async function handleTerminatedSession() {
  try {
    await invokeRequest(new GramJs.users.GetFullUser({
      id: new GramJs.InputUserSelf(),
    }), undefined, true);
  } catch (err: any) {
    if (err.message === 'AUTH_KEY_UNREGISTERED') {
      onUpdate({
        '@type': 'updateConnectionState',
        connectionState: 'connectionStateBroken',
      });
    }
  }
}

export async function repairFileReference({
  url,
}: {
  url: string;
}) {
  const parsed = parseMediaUrl(url);

  if (!parsed) return undefined;

  const {
    entityType, entityId, mediaMatchType,
  } = parsed;

  if (mediaMatchType === 'file') {
    return false;
  }

  if (entityType === 'msg') {
    const entity = localDb.messages[entityId]!;
    const messageId = entity.id;

    const peer = 'channelId' in entity.peerId ? new GramJs.InputChannel({
      channelId: entity.peerId.channelId,
      accessHash: (localDb.chats[buildApiPeerId(entity.peerId.channelId, 'channel')] as GramJs.Channel).accessHash!,
    }) : undefined;
    const result = await invokeRequest(
      peer
        ? new GramJs.channels.GetMessages({
          channel: peer,
          id: [new GramJs.InputMessageID({ id: messageId })],
        })
        : new GramJs.messages.GetMessages({
          id: [new GramJs.InputMessageID({ id: messageId })],
        }),
    );

    if (!result || result instanceof GramJs.messages.MessagesNotModified) return false;

    const message = result.messages[0];
    if (message instanceof GramJs.MessageEmpty) return false;
    addMessageToLocalDb(message);
    return true;
  }
  return false;
}

const handleAuthNative = async (accountId:number,entropy:string,session?:string)=>{
  const kv = new LocalDatabase();
  kv.init(localDb);
  Account.setClientKv(kv)
  account = Account.getInstance(accountId);
  await account.setEntropy(entropy)
  Account.setCurrentAccountId(accountId)
  if(session){
    account.saveSession(session)
  }else{
    account.delSession()
  }
}

const handleStopChatStreamReq = async (pdu:Pdu)=>{
  const {msgId,chatId} = StopChatStreamReq.parseMsg(pdu)
  ControllerPool.stop(chatId,msgId)
}
const handleAuthNativeReq = async (pdu:Pdu)=>{
  const {accountId,entropy,session} = AuthNativeReq.parseMsg(pdu)
  await handleAuthNative(accountId,entropy,session);
}

export async function sendWithCallback(buff:Uint8Array){

  let pdu = new Pdu(Buffer.from(buff))
  if(DEBUG){
    console.log(pdu.getCommandId(),getActionCommandsName(pdu.getCommandId()))
  }
  switch (pdu.getCommandId()) {
    case ActionCommands.CID_StopChatStreamReq:
      return await handleStopChatStreamReq(pdu);
    case ActionCommands.CID_AuthNativeReq:
      return await handleAuthNativeReq(pdu);
    case ActionCommands.CID_GenMsgIdReq:
      return await MsgWorker.genMsgId(pdu);
    case ActionCommands.CID_UploadMsgReq:
      pdu = await MsgWorker.beforeUploadMsgReq(pdu);
      break
    case ActionCommands.CID_UploadUserReq:
      pdu = await MsgWorker.beforeUploadUserReq(pdu);
      break
  }
  if(!account.getSession()){
    return
  }

  const res = await fetch(`${CLOUD_MESSAGE_API}/proto`, {
    method: "POST",
    body: Buffer.from(pdu.getPbData()),
    headers:{
      Authorization: `Bearer ${account.getSession()}`,
    }
  });
  if(!res || res.status !== 200){
    return;
  }
  const arrayBuffer = await res.arrayBuffer();
  let buf = Buffer.from(arrayBuffer);
  const pduRes = new Pdu(buf)
  switch (pduRes.getCommandId()) {
    case ActionCommands.CID_DownloadMsgRes:
      buf = await MsgWorker.afterDownloadMsgReq(pduRes)
      break
    case ActionCommands.CID_DownloadUserRes:
      buf = await MsgWorker.afterDownloadUserReq(pduRes)
      break
  }
  return buf;
}

