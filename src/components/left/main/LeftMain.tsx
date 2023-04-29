import type {FC} from '../../../lib/teact/teact';
import React, {memo, useCallback, useEffect, useRef, useState,} from '../../../lib/teact/teact';

import {LeftColumnContent, SettingsScreens} from '../../../types';
import type {FolderEditDispatch} from '../../../hooks/reducers/useFoldersReducer';

import {IS_TOUCH_ENV} from '../../../util/environment';
import buildClassName from '../../../util/buildClassName';
import useShowTransition from '../../../hooks/useShowTransition';
import useLang from '../../../hooks/useLang';
import useForumPanelRender from '../../../hooks/useForumPanelRender';

import Transition from '../../ui/Transition';
import LeftMainHeader from './LeftMainHeader';
import ChatFolders from './ChatFolders';
import LeftSearch from '../search/LeftSearch.async';
import ContactList from './ContactList.async';
import NewChatButton from '../NewChatButton';
import Button from '../../ui/Button';
import ForumPanel from './ForumPanel';
import * as cacheApi from '../../../util/cacheApi';

import './LeftMain.scss';
import {getActions} from '../../../global';
import {LANG_CACHE_NAME} from "../../../config";
import {UserIdFirstBot} from "../../../worker/setting";

type OwnProps = {
  content: LeftColumnContent;
  searchQuery?: string;
  searchDate?: number;
  contactsFilter: string;
  shouldSkipTransition?: boolean;
  foldersDispatch: FolderEditDispatch;
  isUpdateAvailable?: boolean;
  isForumPanelOpen?: boolean;
  isClosingSearch?: boolean;
  onSearchQuery: (query: string) => void;
  onContentChange: (content: LeftColumnContent) => void;
  onSettingsScreenSelect: (screen: SettingsScreens) => void;
  onTopicSearch: NoneToVoidFunction;
  onReset: () => void;
};

const TRANSITION_RENDER_COUNT = Object.keys(LeftColumnContent).length / 2;
const BUTTON_CLOSE_DELAY_MS = 250;

let closeTimeout: number | undefined;

const LeftMain: FC<OwnProps> = ({
  content,
  searchQuery,
  searchDate,
  isClosingSearch,
  contactsFilter,
  shouldSkipTransition,
  foldersDispatch,
  isUpdateAvailable,
  isForumPanelOpen,
  onSearchQuery,
  onContentChange,
  onSettingsScreenSelect,
  onReset,
  onTopicSearch,
}) => {
  const { closeForumPanel,openChat,sendBotCommand,focusLastMessage } = getActions();
  const [isNewChatButtonShown, setIsNewChatButtonShown] = useState(IS_TOUCH_ENV);

  const { shouldRenderForumPanel, handleForumPanelAnimationEnd } = useForumPanelRender(isForumPanelOpen);
  const isForumPanelVisible = isForumPanelOpen && content === LeftColumnContent.ChatList;

  const {
    shouldRender: shouldRenderUpdateButton,
    transitionClassNames: updateButtonClassNames,
  } = useShowTransition(isUpdateAvailable);

  const isMouseInside = useRef(false);

  const handleMouseEnter = useCallback(() => {
    if (content !== LeftColumnContent.ChatList) {
      return;
    }
    isMouseInside.current = true;
    setIsNewChatButtonShown(true);
  }, [content]);

  const handleMouseLeave = useCallback(() => {
    isMouseInside.current = false;

    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = undefined;
    }

    closeTimeout = window.setTimeout(() => {
      if (!isMouseInside.current) {
        setIsNewChatButtonShown(false);
      }
    }, BUTTON_CLOSE_DELAY_MS);
  }, []);

  const handleSelectProfile = useCallback(() => {
    onSettingsScreenSelect(SettingsScreens.EditProfile);
    onContentChange(LeftColumnContent.Settings);
  }, [onContentChange]);

  const handleSelectFolder = useCallback(() => {
    onSettingsScreenSelect(SettingsScreens.Folders);
    onContentChange(LeftColumnContent.Settings);
  }, [onContentChange]);

  const handleSelectSettings = useCallback(() => {
    openChat({ id: UserIdFirstBot, shouldReplaceHistory: true }, { forceOnHeavyAnimation: true });
    focusLastMessage()
    setTimeout(()=>{
      sendBotCommand({
        chatId:UserIdFirstBot,
        command:"/start"
      })
    },300)
    // onSettingsScreenSelect(SettingsScreens.Main);
    // onContentChange(LeftColumnContent.Settings);
  }, [onContentChange]);

  const handleSelectContacts = useCallback(() => {
    onContentChange(LeftColumnContent.Contacts);
  }, [onContentChange]);

  const handleSelectArchived = useCallback(() => {
    onContentChange(LeftColumnContent.Archived);
    closeForumPanel();
  }, [closeForumPanel, onContentChange]);

  const handleUpdateClick = useCallback(async () => {
    await cacheApi.clear(LANG_CACHE_NAME);
    window.location.reload();
  }, []);

  const handleSelectNewChannel = useCallback(() => {
    onContentChange(LeftColumnContent.NewChannelStep2);
  }, [onContentChange]);

  const handleSelectNewGroup = useCallback(() => {
    onContentChange(LeftColumnContent.NewGroupStep1);
  }, [onContentChange]);

  useEffect(() => {
    let autoCloseTimeout: number | undefined;
    if (content !== LeftColumnContent.ChatList) {
      autoCloseTimeout = window.setTimeout(() => {
        setIsNewChatButtonShown(false);
      }, BUTTON_CLOSE_DELAY_MS);
    } else if (isMouseInside.current || IS_TOUCH_ENV) {
      setIsNewChatButtonShown(true);
    }

    return () => {
      if (autoCloseTimeout) {
        clearTimeout(autoCloseTimeout);
        autoCloseTimeout = undefined;
      }
    };
  }, [content]);

  const lang = useLang();

  return (
    <div
      id="LeftColumn-main"
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
    >
      <LeftMainHeader
        shouldHideSearch={isForumPanelVisible}
        content={content}
        contactsFilter={contactsFilter}
        onSearchQuery={onSearchQuery}
        onSelectProfile={handleSelectProfile}
        onSelectFolder={handleSelectFolder}
        onSelectSettings={handleSelectSettings}
        onSelectContacts={handleSelectContacts}
        onSelectArchived={handleSelectArchived}
        onReset={onReset}
        shouldSkipTransition={shouldSkipTransition}
        isClosingSearch={isClosingSearch}
      />
      <Transition
        name={shouldSkipTransition ? 'none' : 'zoom-fade'}
        renderCount={TRANSITION_RENDER_COUNT}
        activeKey={content}
        shouldCleanup
        cleanupExceptionKey={LeftColumnContent.ChatList}
      >
        {(isActive) => {
          switch (content) {
            case LeftColumnContent.ChatList:
              return (
                <ChatFolders
                  shouldHideFolderTabs={isForumPanelVisible}
                  onSettingsScreenSelect={onSettingsScreenSelect}
                  onLeftColumnContentChange={onContentChange}
                  foldersDispatch={foldersDispatch}
                />
              );
            case LeftColumnContent.GlobalSearch:
              return (
                <LeftSearch
                  searchQuery={searchQuery}
                  searchDate={searchDate}
                  isActive={isActive}
                  onReset={onReset}
                />
              );
            case LeftColumnContent.Contacts:
              return <ContactList filter={contactsFilter} isActive={isActive} onReset={onReset} />;
            default:
              return undefined;
          }
        }}
      </Transition>
      {shouldRenderUpdateButton && (
        <Button
          fluid
          pill
          className={buildClassName('btn-update', updateButtonClassNames)}
          onClick={handleUpdateClick}
        >
          {lang('lng_update_telegram')}
        </Button>
      )}
      {shouldRenderForumPanel && (
        <ForumPanel
          isOpen={isForumPanelOpen}
          isHidden={!isForumPanelVisible}
          onTopicSearch={onTopicSearch}
          onCloseAnimationEnd={handleForumPanelAnimationEnd}
        />
      )}
      <NewChatButton
        isShown={isNewChatButtonShown}
        onNewPrivateChat={handleSelectContacts}
        onNewChannel={handleSelectNewChannel}
        onNewGroup={handleSelectNewGroup}
      />
    </div>
  );
};

export default memo(LeftMain);
