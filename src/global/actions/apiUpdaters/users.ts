import {addActionHandler, getGlobal, setGlobal} from '../../index';

import type {ApiUser, ApiUserStatus} from '../../../api/types';

import {addUsers, addUserStatuses, deleteContact, replaceUserStatuses, updateUser,} from '../../reducers';
import {throttle} from '../../../util/schedulers';
import {selectIsCurrentUserPremium, selectUser} from '../../selectors';
import type {ActionReturnType, GlobalState, RequiredGlobalState} from '../../types';
import {callApiWithPdu} from "../../../worker/msg/utils";
import {SyncReq} from "../../../lib/ptp/protobuf/PTPSync";
import {UserStoreData_Type} from "../../../lib/ptp/protobuf/PTPCommon/types";
import {DEBUG} from "../../../config";
import {currentTs1000} from "../../../worker/share/utils/utils";
import MsgCommand from "../../../worker/msg/MsgCommand";
import {UserIdFirstBot} from "../../../worker/setting";

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

function updateUserStoreData(global:GlobalState,userStoreDataRes?:UserStoreData_Type){
  // console.log("updateUserStoreData",userStoreDataRes)
  if (userStoreDataRes){
    const {chatFolders,...userStoreData} = userStoreDataRes;
    if(DEBUG){
      console.log("updateUserStoreData",userStoreDataRes)
    }
    return {
      ...global,
      userStoreData,
      chatFolders:{
        ...global.chatFolders,
        ...(chatFolders ? JSON.parse(chatFolders!):{})
      }
    }
  }else{
    return global
  }

}

function handleUpdateBots(global:GlobalState,user:ApiUser){
  const user1 = selectUser(global,user.id)
  if(!user1){
    const statusById:Record<string, ApiUserStatus> = {}
    statusById[user.id] = {
      type:'userStatusEmpty'
    }
    global = addUserStatuses(global,statusById);
    global = addUsers(global,{
      [user.id]:user
    })
  }else{
    return updateUser(global, user.id,{
      ...user1,
      avatarHash:user.avatarHash,
      firstName:user.firstName,
      fullInfo:{
        ...user1.fullInfo,
        bio:user.fullInfo?.bio,
        botInfo: {
          ...user1.fullInfo?.botInfo!,
          description:user.fullInfo?.botInfo?.description,
          aiBot:{
            ...user1.fullInfo?.botInfo!.aiBot,
            chatGptConfig:{
              ...user1.fullInfo?.botInfo!.aiBot!.chatGptConfig!,
              welcome:user.fullInfo?.botInfo!.aiBot!.chatGptConfig!.welcome,
              template:user.fullInfo?.botInfo!.aiBot!.chatGptConfig!.template,
              templateSubmit:user.fullInfo?.botInfo!.aiBot!.chatGptConfig!.templateSubmit,
              init_system_content:user.fullInfo?.botInfo!.aiBot!.chatGptConfig!.init_system_content
            }
          }
        }
      }
    });
  }
  return global
}

addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
  switch (update['@type']) {
    case "updateGlobalUpdate":
      const {data} = update
      switch (data.action){
        case "updateBots":
          return handleUpdateBots(global,data.payload.user);
        case "onLogged":
          callApiWithPdu(new SyncReq({}).pack()).catch(console.error)
          break
        case "updateUserStoreData":
          global = updateUserStoreData(global,data.payload!.userStoreData)
          let userStoreData1 = global.userStoreData!
          if(userStoreData1.myBots){
            if(!userStoreData1.chatIdsDeleted){
              userStoreData1.chatIdsDeleted = []
            }
            const userIds = [];
            for (let i = 0; i < userStoreData1.myBots.length; i++) {
              const botId = userStoreData1.myBots[i]
              if(!selectUser(global,botId) && !userStoreData1.chatIdsDeleted.includes(botId)){
                if(botId !== "0" && botId !== UserIdFirstBot){
                  userIds.push(botId)
                }
              }
            }
            if(userIds.length > 0){
              setTimeout(()=>{
                MsgCommand.downloadUsers(userIds).catch(console.error);
              },500)
            }
          }

          return global
        case "updateTopCats":
          return {
            ...global,
            topCats:{
              ...global.topCats,
              ...data.payload!.topCats,
              time:currentTs1000()
            }
          }
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
