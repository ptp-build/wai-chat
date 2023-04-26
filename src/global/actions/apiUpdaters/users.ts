import {addActionHandler, getGlobal, setGlobal} from '../../index';

import type {ApiUserStatus} from '../../../api/types';

import {
  addUsers,
  addUserStatuses,
  deleteContact,
  replaceChats,
  replaceUsers,
  replaceUserStatuses,
  updateUser,
} from '../../reducers';
import {throttle} from '../../../util/schedulers';
import {selectChat, selectIsCurrentUserPremium, selectUser} from '../../selectors';
import type {ActionReturnType, RequiredGlobalState} from '../../types';

const STATUS_UPDATE_THROTTLE = 3000;

const flushStatusUpdatesThrottled = throttle(flushStatusUpdates, STATUS_UPDATE_THROTTLE, true);

let pendingStatusUpdates: Record<string, ApiUserStatus> = {};

function scheduleStatusUpdate(userId: string, statusUpdate: ApiUserStatus) {
  pendingStatusUpdates[userId] = statusUpdate;
  flushStatusUpdatesThrottled();
}

function flushStatusUpdates() {
  // eslint-disable-next-line eslint-multitab-tt/no-immediate-global
  let global = getGlobal() as RequiredGlobalState;

  global = replaceUserStatuses(global, {
    ...global.users.statusesById,
    ...pendingStatusUpdates,
  });
  setGlobal(global);

  pendingStatusUpdates = {};
}


addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
  switch (update['@type']) {
    case "updateGlobalUpdate":
      const {data} = update
      switch (data.action){
        case "updateChatGptHistory":
          const chatId = data.payload!.chatId;
          return {
            ...global,
            chatGptAskHistory:{
              ...global.chatGptAskHistory,
              [chatId]:{
                ...global.chatGptAskHistory[chatId],
                [data.payload!.msgIdAssistant]:data.payload!.msgIdUser
              }
            }
          }
        case "updateBot":
          const userBotUpdate = {
            ...global.users.byId[data.payload!.botInfo.botId],
            bot:data.payload!.bot
          };
          if(data.payload!.bot.chatGptConfig && data.payload!.bot.chatGptConfig.api_key){
            localStorage.setItem("open-api-key" , data.payload!.bot.chatGptConfig.api_key)
          }
          return updateUser(global,data.payload!.botInfo.botId,userBotUpdate)
        case "clearHistory":
          actions.updateGlobal({
            messages:{
              ...global.messages,
              byChatId: {
                ...global.messages.byChatId,
                [data.payload!.chatId]:{
                  ...global.messages.byChatId[data.payload!.chatId],
                  byId:{},
                  threadsById:{
                    "-1":{
                      ...global.messages.byChatId[data.payload!.chatId].threadsById["-1"],
                      lastScrollOffset:undefined,
                      lastViewportIds: [],
                      listedIds:[]
                    }
                  }
                }
              }
            },
            chats:{
              ...global.chats,
              byId:{
                ...global.chats.byId,
                [data.payload!.chatId]:{
                  ...global.chats.byId[data.payload!.chatId],
                  lastMessage:undefined
                }
              }
            }
          })
          break;
        case "removeBot":
          if(global.chats.listIds && global.chats.listIds.active){
            let listIds_active = global.chats.listIds.active
            listIds_active = listIds_active!.filter(id=>id !== data.payload!.chatId)
            actions.updateGlobal({
              chats:{
                ...global.chats,
                listIds: {
                  ...global.chats.listIds,
                  active:listIds_active
                },
                totalCount: {
                  ...global.chats.totalCount,
                  all:listIds_active.length
                }
              }
            })
            // @ts-ignore
            actions.openChat({ id: undefined }, { forceOnHeavyAnimation: true });
            actions.loadAllChats({ listType: 'active', shouldReplace: true });
          }
          return
      }
      break
    case 'deleteContact': {
      return deleteContact(global, update.id);
    }

    case 'updateUser': {
      Object.values(global.byTabId).forEach(({ id: tabId }) => {
        if (update.id === global.currentUserId && update.user.isPremium !== selectIsCurrentUserPremium(global)) {
          // TODO Do not display modal if premium is bought from another device
          if (update.user.isPremium) actions.openPremiumModal({ isSuccess: true, tabId });

          // Reset translation cache cause premium provides additional formatting
          global = {
            ...global,
            translations: {
              byChatId: {},
            },
          };
        }
      });
      if(selectUser(global,update.id)){
        return updateUser(global, update.id, update.user);
      }else{
        if(update.user.fullInfo && update.user.fullInfo.botInfo){
          global = addUserStatuses(global,{
            [update.user.id]:{
              type:'userStatusEmpty'
            }
          });
        }
        return addUsers(global, {
          [update.id]:update.user
        });
      }
    }

    case 'updateRequestUserUpdate': {
      actions.loadFullUser({ userId: update.id });
      break;
    }

    case 'updateUserEmojiStatus': {
      return updateUser(global, update.userId, { emojiStatus: update.emojiStatus });
    }

    case 'updateUserStatus': {
      // Status updates come very often so we throttle them
      scheduleStatusUpdate(update.userId, update.status);
      return undefined;
    }

    case 'updateUserFullInfo': {
      const { id, fullInfo } = update;
      const targetUser = global.users.byId[id];
      if (!targetUser) {
        return undefined;
      }

      return updateUser(global, id, {
        fullInfo: {
          ...targetUser.fullInfo,
          ...fullInfo,
        },
      });
    }

    case 'updateBotMenuButton': {
      const { botId, button } = update;

      const targetUser = selectUser(global, botId);
      if (!targetUser?.fullInfo?.botInfo) {
        return undefined;
      }

      return updateUser(global, botId, {
        fullInfo: {
          ...targetUser.fullInfo,
          botInfo: {
            ...targetUser.fullInfo.botInfo,
            menuButton: button,
          },
        },
      });
    }
  }

  return undefined;
});
