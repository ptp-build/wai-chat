import type {FC} from '../../../lib/teact/teact';
import React, {memo, useCallback, useMemo, useRef, useState,} from '../../../lib/teact/teact';
import {getActions, withGlobal} from '../../../global';

import {GlobalSearchContent} from '../../../types';

import {selectTabState} from '../../../global/selectors';
import {parseDateString} from '../../../util/dateFormat';
import useKeyboardListNavigation from '../../../hooks/useKeyboardListNavigation';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';

import TabList from '../../ui/TabList';
import Transition from '../../ui/Transition';
import ChatResults from './ChatResults';

import './LeftSearch.scss';
import BotUser from "./BotUser";

export type OwnProps = {
  searchQuery?: string;
  searchDate?: number;
  isActive: boolean;
  onReset: () => void;
};

type StateProps = {
  tabs:{type:number,title:string}[],
  cats:{title:string,botIds:string[]}[],
  topSearchPlaceHolder?:string,
  currentContent?: GlobalSearchContent;
  chatId?: string;
};

const TABS = [
  { type: GlobalSearchContent.ChatList, title: 'SearchAllChatsShort' },
  { type: GlobalSearchContent.Media, title: 'SharedMediaTab2' },
  { type: GlobalSearchContent.Links, title: 'SharedLinksTab2' },
  { type: GlobalSearchContent.Files, title: 'SharedFilesTab2' },
  { type: GlobalSearchContent.Music, title: 'SharedMusicTab2' },
  { type: GlobalSearchContent.Voice, title: 'SharedVoiceTab2' },
];

const CHAT_TABS = [
  { type: GlobalSearchContent.ChatList, title: 'All Messages' },
  ...TABS.slice(1),
];

const TRANSITION_RENDER_COUNT = Object.keys(GlobalSearchContent).length / 2;

const LeftSearch: FC<OwnProps & StateProps> = ({
  tabs,
  searchQuery,
  searchDate,
  isActive,
  currentContent = GlobalSearchContent.ChatList,
  onReset,
}) => {
  const {
    setGlobalSearchContent,
    setGlobalSearchDate,
  } = getActions();

  const lang = useLang();
  const [activeTab, setActiveTab] = useState(0);
  const dateSearchQuery = useMemo(() => parseDateString(searchQuery), [searchQuery]);

  const handleSwitchTab = useCallback((index: number) => {
    if(tabs && tabs[index]){
      const tab = tabs[index];
      setGlobalSearchContent({ content: tab.type });
      setActiveTab(index);
    }else{
      setGlobalSearchContent({ content: 0 });
      setActiveTab(0);
    }
  }, [setGlobalSearchContent]);

  const handleSearchDateSelect = useCallback((value: Date) => {
    setGlobalSearchDate({ date: value.getTime() / 1000 });
  }, [setGlobalSearchDate]);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const handleKeyDown = useKeyboardListNavigation(containerRef, isActive, undefined, '.ListItem-button', true);
  const renderCount = tabs.length+1
  return (
    <div className="LeftSearch" ref={containerRef} onKeyDown={handleKeyDown}>
      {
        tabs.length > 1 && <TabList activeTab={currentContent} tabs={tabs} onSwitchTab={handleSwitchTab} />
      }

      <Transition
        name={lang.isRtl ? 'slide-optimized-rtl' : 'slide-optimized'}
        renderCount={renderCount}
        activeKey={currentContent}
      >
        {(() => {
          switch (currentContent) {
            case 0:
              return (
                <ChatResults
                  searchQuery={searchQuery}
                  searchDate={searchDate}
                  dateSearchQuery={dateSearchQuery}
                  onReset={onReset}
                  onSearchDateSelect={handleSearchDateSelect}
                />
              );
            default:
              return <BotUser searchQuery={searchQuery} onReset={onReset} activeTab={currentContent}/>;
          }
        })()}
      </Transition>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { currentContent, chatId } = selectTabState(global).globalSearch;
    const {topCats} = global
    const {cats} = topCats
    const tabs = cats ? cats!.map((row,i)=>{
      return {type:i,title:row.title}
    }):[
      {
        type: 0,
        title:"全部"
      }
    ]
    tabs[0].title = "全部"
    return {
      cats:cats || [],
      tabs,
      currentContent,
      chatId
    };
  },
)(LeftSearch));
