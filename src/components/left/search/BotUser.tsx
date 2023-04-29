import type {FC} from '../../../lib/teact/teact';
import React, {memo, useCallback} from '../../../lib/teact/teact';
import {getActions, getGlobal, withGlobal} from '../../../global';

import PrivateChatInfo from '../../common/PrivateChatInfo';
import ListItem from '../../ui/ListItem';
import InfiniteScroll from "../../ui/InfiniteScroll";
import {selectUser} from "../../../global/selectors";

type OwnProps = {
  searchQuery?: string;
  activeTab: number;
  onReset: () => void;
  onClick: (id: string) => void;
};

type StateProps = {
  botIds?:string[],
};
const SEARCH_CLOSE_TIMEOUT_MS = 250;

const BotUser: FC<OwnProps & StateProps> = ({
  botIds,
  onClick,
  onReset,
  activeTab,
}) => {

  const {
    openChat,
    openTopBotChat,
    setActiveChatFolder,
    sendBotCommand,
    addRecentlyFoundChatId,
  } = getActions();

  const handleClick = useCallback((e,id) => {
    let global = getGlobal()
    let shouldSend = false
    if(!global.chats.byId[id]){
      openTopBotChat({id})
      shouldSend = true;
    }

    openChat({ id, shouldReplaceHistory: true });
    setActiveChatFolder({ activeChatFolder: 0 }, { forceOnHeavyAnimation: true });
    onReset();
    setTimeout(() => {
      addRecentlyFoundChatId({ id });
      if(shouldSend){
        sendBotCommand({chatId:id,command:"/start"})
      }
    }, SEARCH_CLOSE_TIMEOUT_MS);
    onReset();
  }, [ onClick]);
  return (
      <InfiniteScroll
        className="LeftSearch custom-scroll"
        items={botIds || []}
        noScrollRestoreOnTop
        noFastList
      >
        <div>
          {
            activeTab === 0 &&
            <div className="pl-2 pt-2 mb-0 mt-1 font-14">
              🔥 热门
            </div>
          }
        {
          botIds && botIds.map(userId=>(
            <ListItem
              className="chat-item-clickable search-result"
              onClick={handleClick}
              clickArg={userId}
            >
              <PrivateChatInfo userId={userId} withUsername={false} avatarSize="large" withDesc />
            </ListItem>
          ))
        }
      </div>
      </InfiniteScroll>  );
};

export default memo(withGlobal<OwnProps>(
  (global, { searchQuery,activeTab }): StateProps => {
    const {topCats} = global
    const {cats} = topCats
    let botIds:string[] = []
    if(cats && cats![activeTab]){
      botIds = cats![activeTab].botIds
    }

    let botIds_:string[] = [];
    if(searchQuery){
      for (let i = 0; i < botIds.length; i++) {
        const botId = botIds[i];
        const user = selectUser(global,botId);
        if(user){
          const {firstName,fullInfo}  = user;
          const {botInfo} = fullInfo!
          if(
            firstName!.toLowerCase().indexOf(searchQuery) > -1 ||
            botInfo && botInfo.description!.toLocaleString().indexOf(searchQuery) > -1
          ){
            botIds_.push(botId)
          }
        }
      }
    }else{
      botIds_ = botIds
    }
    return {
      botIds:botIds_,
    };
  },
)(BotUser));
