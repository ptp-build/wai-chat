import {addActionHandler, getGlobal, setGlobal,} from '../../index';

import {callApi, callApiLocal, initApi} from '../../../api/gramjs';

import {
  CUSTOM_BG_CACHE_NAME,
  IS_TEST,
  LANG_CACHE_NAME,
  LOCK_SCREEN_ANIMATION_DURATION_MS,
  MEDIA_CACHE_NAME,
  MEDIA_CACHE_NAME_AVATARS,
  MEDIA_PROGRESSIVE_CACHE_NAME,
} from '../../../config';
import {IS_MOV_SUPPORTED, IS_WEBM_SUPPORTED, MAX_BUFFER_SIZE, PLATFORM_ENV,} from '../../../util/environment';
import {unsubscribe} from '../../../util/notifications';
import * as cacheApi from '../../../util/cacheApi';
import {updateAppBadge} from '../../../util/appBadge';
import {
  clearLegacySessions,
  clearStoredSession,
  importLegacySession,
  loadStoredSession,
  storeSession,
} from '../../../util/sessions';
import {addUsers, clearGlobalForLockScreen, updatePasscodeSettings} from '../../reducers';
import {clearEncryptedSession, encryptSession, forgetPasscode} from '../../../util/passcode';
import {serializeGlobal} from '../../cache';
import {parseInitialLocationHash} from '../../../util/routing';
import type {ActionReturnType} from '../../types';
import {buildCollectionByKey} from '../../../util/iteratees';
import Account from "../../../worker/share/Account";
import LocalStorage from "../../../worker/share/db/LocalStorage";
import Mnemonic from "../../../lib/ptp/wallet/Mnemonic";
import {hashSha256} from "../../../worker/share/utils/helpers";
import {callApiWithPdu} from "../../../worker/msg/utils";
import {AuthNativeReq} from "../../../lib/ptp/protobuf/PTPAuth";

addActionHandler('updateGlobal', (global,action,payload): ActionReturnType => {
  return {
    ...global,
    ...payload,
  };
});

addActionHandler('initApi', async (global, actions): Promise<void> => {
  if (!IS_TEST) {
    await importLegacySession();
    void clearLegacySessions();
  }

  const initialLocationHash = parseInitialLocationHash();
  Account.setClientKv(new LocalStorage())
  const accountId = Account.getCurrentAccountId();
  let account = Account.getInstance(accountId);
  const entropy = await account.getEntropy();
  const session = account.getSession()

  void initApi(actions.apiUpdate, {
    userAgent: navigator.userAgent,
    platform: PLATFORM_ENV,
    sessionData: loadStoredSession(),
    isTest: window.location.search.includes('test') || initialLocationHash?.tgWebAuthTest === '1',
    isMovSupported: IS_MOV_SUPPORTED,
    isWebmSupported: IS_WEBM_SUPPORTED,
    maxBufferSize: MAX_BUFFER_SIZE,
    webAuthToken: initialLocationHash?.tgWebAuthToken,
    dcId: initialLocationHash?.tgWebAuthDcId ? Number(initialLocationHash?.tgWebAuthDcId) : undefined,
    mockScenario: initialLocationHash?.mockScenario,
    accountId,entropy,session
  });

});

addActionHandler('setAuthPhoneNumber', (global, actions, payload): ActionReturnType => {
  const { phoneNumber } = payload!;

  void callApi('provideAuthPhoneNumber', phoneNumber.replace(/[^\d]/g, ''));

  return {
    ...global,
    authIsLoading: true,
    authError: undefined,
  };
});

addActionHandler('setAuthCode', (global, actions, payload): ActionReturnType => {
  const { code } = payload!;

  void callApi('provideAuthCode', code);

  return {
    ...global,
    authIsLoading: true,
    authError: undefined,
  };
});

// @ts-ignore
addActionHandler('setAuthPassword', async (global, actions, payload): Promise<ActionReturnType> => {

});

addActionHandler('uploadProfilePhoto', async (global, actions, payload): Promise<void> => {
  const {
    file, isFallback, isVideo, videoTs,
  } = payload!;
  const res = await callApi('uploadProfilePhoto', file, isFallback, isVideo, videoTs);
  if (!res) return;

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey([{
    ...global.users.byId[global.currentUserId!],
    ...res
  }], 'id'));
  setGlobal(global);
  // actions.loadFullUser({ userId: global.currentUserId! });
});

addActionHandler('signUp', (global, actions, payload): ActionReturnType => {
  const { firstName, lastName } = payload!;

  void callApi('provideAuthRegistration', { firstName, lastName });

  return {
    ...global,
    authIsLoading: true,
    authError: undefined,
  };
});

addActionHandler('returnToAuthPhoneNumber', (global): ActionReturnType => {
  void callApi('restartAuth');

  return {
    ...global,
    authError: undefined,
  };
});

addActionHandler('goToAuthQrCode', (global): ActionReturnType => {
  void callApi('restartAuthWithQr');

  return {
    ...global,
    authIsLoadingQrCode: true,
    authError: undefined,
  };
});

addActionHandler('saveSession', (global, actions, payload): ActionReturnType => {
  if (global.passcode.isScreenLocked) {
    return;
  }

  const { sessionData } = payload;
  if (sessionData) {
    storeSession(sessionData, global.currentUserId);
  } else {
    clearStoredSession();
  }
});

addActionHandler('signOut', async (global, actions, payload): Promise<void> => {
  setGlobal({
    ...global,
    isLoggingOut:true,
    passcode:{},
    chats:{
      ...global.chats,
      listIds:{
        ...global.chats.listIds,
        active:[]
      }
    },
  })
  try {
    await unsubscribe();
  } catch (err) {
    // Do nothing
  }

  if (payload?.forceInitApi) {
    actions.initApi();
  }

  global = getGlobal();
  setGlobal({
    ...global,
    authState:"authorizationStateWaitPassword",
    isLoggingOut:false,
  })
});

addActionHandler('reset', (global, actions): ActionReturnType => {
  clearStoredSession();
  clearEncryptedSession();

  void cacheApi.clear(MEDIA_CACHE_NAME);
  void cacheApi.clear(MEDIA_CACHE_NAME_AVATARS);
  void cacheApi.clear(MEDIA_PROGRESSIVE_CACHE_NAME);
  void cacheApi.clear(CUSTOM_BG_CACHE_NAME);

  const langCachePrefix = LANG_CACHE_NAME.replace(/\d+$/, '');
  const langCacheVersion = (LANG_CACHE_NAME.match(/\d+$/) || [0])[0];
  for (let i = 0; i < langCacheVersion; i++) {
    void cacheApi.clear(`${langCachePrefix}${i === 0 ? '' : i}`);
  }

  void clearLegacySessions();

  updateAppBadge(0);

  actions.initShared({ force: true });
  Object.values(global.byTabId).forEach(({ id: otherTabId, isMasterTab }) => {
    actions.init({ tabId: otherTabId, isMasterTab });
  });
});

addActionHandler('disconnect', (): ActionReturnType => {
  void callApiLocal('disconnect');
});

addActionHandler('destroyConnection', (): ActionReturnType => {
  void callApiLocal('destroy', true, true);
});

addActionHandler('loadNearestCountry', async (global): Promise<void> => {
  if (global.connectionState !== 'connectionStateReady') {
    return;
  }

  const authNearestCountry = await callApi('fetchNearestCountry');

  global = getGlobal();
  global = {
    ...global,
    authNearestCountry,
  };
  setGlobal(global);
});

addActionHandler('setDeviceToken', (global, actions, deviceToken): ActionReturnType => {
  return {
    ...global,
    push: {
      deviceToken,
      subscribedAt: Date.now(),
    },
  };
});

addActionHandler('deleteDeviceToken', (global): ActionReturnType => {
  return {
    ...global,
    push: undefined,
  };
});

addActionHandler('lockScreen', async (global): Promise<void> => {
  const sessionJson = JSON.stringify({ ...loadStoredSession(), userId: global.currentUserId });
  const globalJson = await serializeGlobal(global);

  await encryptSession(sessionJson, globalJson);
  forgetPasscode();
  clearStoredSession();
  updateAppBadge(0);

  global = getGlobal();
  global = updatePasscodeSettings(
    global,
    {
      isScreenLocked: true,
      invalidAttemptsCount: 0,
    },
  );
  setGlobal(global);

  setTimeout(() => {
    global = getGlobal();
    global = clearGlobalForLockScreen(global);
    setGlobal(global);
  }, LOCK_SCREEN_ANIMATION_DURATION_MS);

  try {
    await unsubscribe();
    await callApi('destroy', true);
  } catch (err) {
    // Do nothing
  }
});
