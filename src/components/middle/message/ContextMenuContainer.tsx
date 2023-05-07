import type {FC} from '../../../lib/teact/teact';
import React, {memo, useCallback, useEffect, useMemo, useState,} from '../../../lib/teact/teact';
import {getActions, getGlobal, withGlobal} from '../../../global';

import type {MessageListType} from '../../../global/types';
import type {
  ApiAvailableReaction,
  ApiChatReactions,
  ApiMessage,
  ApiReaction,
  ApiStickerSet,
  ApiStickerSetInfo,
  ApiThreadInfo,
} from '../../../api/types';
import type {IAlbum, IAnchorPosition} from '../../../types';

import {
  selectActiveDownloadIds,
  selectAllowedMessageActions,
  selectCanScheduleUntilOnline,
  selectChat,
  selectCurrentMessageList,
  selectIsCurrentUserPremium,
  selectIsMessageProtected,
  selectIsPremiumPurchaseBlocked,
  selectMessageCustomEmojiSets,
  selectMessageTranslations,
  selectRequestedTranslationLanguage,
  selectStickerSet,
} from '../../../global/selectors';
import {
  areReactionsEmpty,
  getChatMessageLink,
  getMessageVideo,
  isActionMessage,
  isChatChannel,
  isChatGroup,
  isMessageLocal,
  isOwnMessage,
  isUserId,
} from '../../../global/helpers';
import {SERVICE_NOTIFICATIONS_USER_ID} from '../../../config';
import {IS_TRANSLATION_SUPPORTED} from '../../../util/environment';
import buildClassName from '../../../util/buildClassName';
import {copyTextToClipboard} from '../../../util/clipboard';

import useShowTransition from '../../../hooks/useShowTransition';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useSchedule from '../../../hooks/useSchedule';

import DeleteMessageModal from '../../common/DeleteMessageModal';
import ReportModal from '../../common/ReportModal';
import PinMessageModal from '../../common/PinMessageModal';
import MessageContextMenu from './MessageContextMenu';
import ConfirmDialog from '../../ui/ConfirmDialog';
import ShareModal from "../../common/ShareModal";

export type OwnProps = {
  isOpen: boolean;
  chatUsername?: string;
  message: ApiMessage;
  album?: IAlbum;
  anchor: IAnchorPosition;
  messageListType: MessageListType;
  noReplies?: boolean;
  detectedLanguage?: string;
  onClose: () => void;
  onCloseAnimationEnd: () => void;
  repliesThreadInfo?: ApiThreadInfo;
};

type StateProps = {
  aiAssistantMsgId?:number,
  aiUserMsgId?:number,
  availableReactions?: ApiAvailableReaction[];
  customEmojiSetsInfo?: ApiStickerSetInfo[];
  customEmojiSets?: ApiStickerSet[];
  noOptions?: boolean;
  canSendNow?: boolean;
  canReschedule?: boolean;
  canReply?: boolean;
  canPin?: boolean;
  canShowReactionsCount?: boolean;
  canBuyPremium?: boolean;
  canShowReactionList?: boolean;
  canUnpin?: boolean;
  canDelete?: boolean;
  canReport?: boolean;
  canEdit?: boolean;
  canForward?: boolean;
  canFaveSticker?: boolean;
  canUnfaveSticker?: boolean;
  canCopy?: boolean;
  canTranslate?: boolean;
  canShowOriginal?: boolean;
  canSelectLanguage?: boolean;
  isPrivate?: boolean;
  isCurrentUserPremium?: boolean;
  hasFullInfo?: boolean;
  canCopyLink?: boolean;
  canSelect?: boolean;
  canDownload?: boolean;
  canSaveGif?: boolean;
  canRevote?: boolean;
  canClosePoll?: boolean;
  activeDownloads: number[];
  canShowSeenBy?: boolean;
  enabledReactions?: ApiChatReactions;
  canScheduleUntilOnline?: boolean;
  maxUniqueReactions?: number;
  threadId?: number;
};

const ContextMenuContainer: FC<OwnProps & StateProps> = ({
  aiAssistantMsgId,
  aiUserMsgId,
  availableReactions,
  isOpen,
  messageListType,
  chatUsername,
  message,
  customEmojiSetsInfo,
  customEmojiSets,
  album,
  anchor,
  noOptions,
  canSendNow,
  hasFullInfo,
  canReschedule,
  canReply,
  canPin,
  repliesThreadInfo,
  canUnpin,
  canDelete,
  canReport,
  canShowReactionsCount,
  canShowReactionList,
  canEdit,
  enabledReactions,
  maxUniqueReactions,
  isPrivate,
  isCurrentUserPremium,
  canForward,
  canBuyPremium,
  canFaveSticker,
  canUnfaveSticker,
  canCopy,
  canCopyLink,
  canSelect,
  canDownload,
  canSaveGif,
  canRevote,
  canClosePoll,
  activeDownloads,
  noReplies,
  canShowSeenBy,
  canScheduleUntilOnline,
  canTranslate,
  canShowOriginal,
  canSelectLanguage,
  threadId,
  onClose,
  onCloseAnimationEnd,
}) => {
  const {
    openChat,
    setReplyingToId,
    onSpeak,
    setEditingId,
    pinMessage,
    openForwardMenu,
    faveSticker,
    unfaveSticker,
    toggleMessageSelection,
    sendScheduledMessages,
    rescheduleMessage,
    downloadMessageMedia,
    cancelMessageMediaDownload,
    loadSeenBy,
    openSeenByModal,
    openReactorListModal,
    loadFullChat,
    loadReactors,
    copyMessagesByIds,
    saveGif,
    loadStickers,
    cancelPollVote,
    closePoll,
    toggleReaction,
    requestMessageTranslation,
    showOriginalMessage,
    openMessageLanguageModal,
  } = getActions();

  const lang = useLang();
  const { transitionClassNames } = useShowTransition(isOpen, onCloseAnimationEnd, undefined, false);
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isClosePollDialogOpen, openClosePollDialog, closeClosePollDialog] = useFlag();

  const [requestCalendar, calendar] = useSchedule(canScheduleUntilOnline, onClose, message.date);

  // `undefined` indicates that emoji are present and loading
  const hasCustomEmoji = customEmojiSetsInfo === undefined || Boolean(customEmojiSetsInfo.length);

  useEffect(() => {
    if (canShowSeenBy && isOpen) {
      loadSeenBy({ chatId: message.chatId, messageId: message.id });
    }
  }, [loadSeenBy, isOpen, message.chatId, message.id, canShowSeenBy]);

  useEffect(() => {
    if (canShowReactionsCount && isOpen) {
      loadReactors({ chatId: message.chatId, messageId: message.id });
    }
  }, [canShowReactionsCount, isOpen, loadReactors, message.chatId, message.id]);

  useEffect(() => {
    if (customEmojiSetsInfo?.length && customEmojiSets?.length !== customEmojiSetsInfo.length) {
      customEmojiSetsInfo.forEach((set) => {
        loadStickers({ stickerSetInfo: set });
      });
    }
  }, [customEmojiSetsInfo, customEmojiSets, loadStickers]);

  useEffect(() => {
    if (!hasFullInfo && !isPrivate && isOpen) {
      loadFullChat({ chatId: message.chatId });
    }
  }, [hasFullInfo, isOpen, isPrivate, loadFullChat, message.chatId]);

  const seenByRecentUsers = useMemo(() => {
    if (message.reactions?.recentReactions?.length) {
      // No need for expensive global updates on users, so we avoid them
      const usersById = getGlobal().users.byId;

      const uniqueReactors = new Set(message.reactions?.recentReactions?.map(({ userId }) => usersById[userId]));

      return Array.from(uniqueReactors).filter(Boolean).slice(0, 3);
    }

    if (!message.seenByUserIds) {
      return undefined;
    }

    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;
    return message.seenByUserIds?.slice(0, 3).map((id) => usersById[id]).filter(Boolean);
  }, [message.reactions?.recentReactions, message.seenByUserIds]);

  const isDownloading = album ? album.messages.some((msg) => activeDownloads.includes(msg.id))
    : activeDownloads.includes(message.id);

  const handleDelete = useCallback(() => {
    setIsMenuOpen(false);
    setIsDeleteModalOpen(true);
  }, []);

  const handleReport = useCallback(() => {
    setIsMenuOpen(false);
    setIsReportModalOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    onClose();
  }, [onClose]);

  const closeDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(false);
    onClose();
  }, [onClose]);

  const closeReportModal = useCallback(() => {
    setIsReportModalOpen(false);
    onClose();
  }, [onClose]);

  const closeShareModal = useCallback(() => {
    setIsShareModalOpen(false);
    onClose();
  }, [onClose]);
  const closePinModal = useCallback(() => {
    setIsPinModalOpen(false);
    onClose();
  }, [onClose]);

  const handleSpeak = useCallback(() => {
    onSpeak({ messageId: message.id,chatId:message.chatId });
    closeMenu();
  },  [message.id, closeMenu]);

  const handleReply = useCallback(() => {
    setReplyingToId({ messageId: message.id });
    closeMenu();
  }, [setReplyingToId, message.id, closeMenu]);

  const handleOpenThread = useCallback(() => {
    openChat({
      id: message.chatId,
      threadId: message.id,
    });
    closeMenu();
  }, [closeMenu, message.chatId, message.id, openChat]);

  const handleEdit = useCallback(() => {
    setEditingId({ messageId: message.id });
    closeMenu();
  }, [setEditingId, message.id, closeMenu]);

  const handlePin = useCallback(() => {
    setIsMenuOpen(false);
    setIsPinModalOpen(true);
  }, []);

  const handleUnpin = useCallback(() => {
    pinMessage({ messageId: message.id, isUnpin: true });
    closeMenu();
  }, [pinMessage, message.id, closeMenu]);

  const handleForward = useCallback(() => {
    closeMenu();
    if (album?.messages) {
      const messageIds = album.messages.map(({ id }) => id);
      openForwardMenu({ fromChatId: message.chatId, messageIds });
    } else {
      openForwardMenu({ fromChatId: message.chatId, messageIds: [message.id] });
    }
  }, [openForwardMenu, message, closeMenu, album]);

  const handleFaveSticker = useCallback(() => {
    closeMenu();
    faveSticker({ sticker: message.content.sticker! });
  }, [closeMenu, message.content.sticker, faveSticker]);

  const handleUnfaveSticker = useCallback(() => {
    closeMenu();
    unfaveSticker({ sticker: message.content.sticker! });
  }, [closeMenu, message.content.sticker, unfaveSticker]);

  const handleCancelVote = useCallback(() => {
    closeMenu();
    cancelPollVote({ chatId: message.chatId, messageId: message.id });
  }, [closeMenu, message, cancelPollVote]);

  const handlePollClose = useCallback(() => {
    closeMenu();
    closePoll({ chatId: message.chatId, messageId: message.id });
  }, [closeMenu, message, closePoll]);

  const handleSelectMessage = useCallback(() => {
    const params = album?.messages
      ? {
        messageId: message.id,
        childMessageIds: album.messages.map(({ id }) => id),
        withShift: false,
      }
      : { messageId: message.id, withShift: false };

    toggleMessageSelection(params);
    closeMenu();
  }, [closeMenu, message.id, toggleMessageSelection, album]);

  const handleScheduledMessageSend = useCallback(() => {
    sendScheduledMessages({ chatId: message.chatId, id: message.id });
    closeMenu();
  }, [closeMenu, message.chatId, message.id, sendScheduledMessages]);

  const handleRescheduleMessage = useCallback((scheduledAt: number) => {
    rescheduleMessage({
      chatId: message.chatId,
      messageId: message.id,
      scheduledAt,
    });
    onClose();
  }, [message.chatId, message.id, onClose, rescheduleMessage]);

  const handleOpenCalendar = useCallback(() => {
    setIsMenuOpen(false);
    requestCalendar(handleRescheduleMessage);
  }, [handleRescheduleMessage, requestCalendar]);

  const handleOpenSeenByModal = useCallback(() => {
    closeMenu();
    openSeenByModal({ chatId: message.chatId, messageId: message.id });
  }, [closeMenu, message.chatId, message.id, openSeenByModal]);

  const handleOpenReactorListModal = useCallback(() => {
    closeMenu();
    openReactorListModal({ chatId: message.chatId, messageId: message.id });
  }, [closeMenu, openReactorListModal, message.chatId, message.id]);

  const handleCopyMessages = useCallback((messageIds: number[]) => {
    copyMessagesByIds({ messageIds });
    closeMenu();
  }, [closeMenu, copyMessagesByIds]);

  const handleCopyLink = useCallback(() => {
    copyTextToClipboard(getChatMessageLink(message.chatId, chatUsername, threadId, message.id));
    closeMenu();
  }, [chatUsername, closeMenu, message, threadId]);

  const handleCopyNumber = useCallback(() => {
    copyTextToClipboard(message.content.contact!.phoneNumber);
    closeMenu();
  }, [closeMenu, message]);

  const handleDownloadClick = useCallback(() => {
    (album?.messages || [message]).forEach((msg) => {
      if (isDownloading) {
        cancelMessageMediaDownload({ message: msg });
      } else {
        downloadMessageMedia({ message: msg });
      }
    });
    closeMenu();
  }, [album, message, closeMenu, isDownloading, cancelMessageMediaDownload, downloadMessageMedia]);

  const handleSaveGif = useCallback(() => {
    const video = getMessageVideo(message);
    saveGif({ gif: video! });
    closeMenu();
  }, [closeMenu, message, saveGif]);

  const handleToggleReaction = useCallback((reaction: ApiReaction) => {
    toggleReaction({
      chatId: message.chatId, messageId: message.id, reaction,
    });
    closeMenu();
  }, [closeMenu, message, toggleReaction]);

  const handleTranslate = useCallback(() => {
    requestMessageTranslation({
      chatId: message.chatId,
      id: message.id,
    });
    closeMenu();
  }, [closeMenu, message, requestMessageTranslation]);

  const handleShowOriginal = useCallback(() => {
    showOriginalMessage({
      chatId: message.chatId,
      id: message.id,
    });
    closeMenu();
  }, [closeMenu, message, showOriginalMessage]);
  const handleShare = useCallback(() => {
    setIsMenuOpen(false);
    setTimeout(()=>{
      setIsShareModalOpen(true)
    },500)
  },[setIsShareModalOpen])
  const handleSelectLanguage = useCallback(() => {
    openMessageLanguageModal({
      chatId: message.chatId,
      id: message.id,
    });
    closeMenu();
  }, [closeMenu, message.chatId, message.id, openMessageLanguageModal]);

  const reportMessageIds = useMemo(() => (album ? album.messages : [message]).map(({ id }) => id), [album, message]);

  if (noOptions) {
    closeMenu();

    return undefined;
  }

  const scheduledMaxDate = new Date();
  scheduledMaxDate.setFullYear(scheduledMaxDate.getFullYear() + 1);

  return (
    <div className={buildClassName('ContextMenuContainer', transitionClassNames)}>
      <MessageContextMenu
        availableReactions={availableReactions}
        message={message}
        isPrivate={isPrivate}
        isCurrentUserPremium={isCurrentUserPremium}
        canBuyPremium={canBuyPremium}
        isOpen={isMenuOpen}
        enabledReactions={enabledReactions}
        maxUniqueReactions={maxUniqueReactions}
        anchor={anchor}
        canShowReactionsCount={canShowReactionsCount}
        canShowReactionList={canShowReactionList}
        canSendNow={canSendNow}
        canReschedule={canReschedule}
        canReply={canReply}
        canDelete={canDelete}
        canReport={canReport}
        canPin={canPin}
        repliesThreadInfo={repliesThreadInfo}
        canUnpin={canUnpin}
        canEdit={canEdit}
        canForward={canForward}
        canFaveSticker={canFaveSticker}
        canUnfaveSticker={canUnfaveSticker}
        canCopy={canCopy}
        canCopyLink={canCopyLink}
        canSelect={canSelect}
        canDownload={canDownload}
        canSaveGif={canSaveGif}
        canRevote={canRevote}
        canClosePoll={canClosePoll}
        canShowSeenBy={canShowSeenBy}
        canTranslate={false}
        canShowOriginal={canShowOriginal}
        canSelectLanguage={true}
        hasCustomEmoji={hasCustomEmoji}
        customEmojiSets={customEmojiSets}
        isDownloading={isDownloading}
        seenByRecentUsers={seenByRecentUsers}
        noReplies={noReplies}
        onOpenThread={handleOpenThread}
        onReply={handleReply}
        onSpeak={handleSpeak}
        onEdit={handleEdit}
        onPin={handlePin}
        onUnpin={handleUnpin}
        onForward={handleForward}
        onDelete={handleDelete}
        onReport={handleReport}
        onFaveSticker={handleFaveSticker}
        onUnfaveSticker={handleUnfaveSticker}
        onSelect={handleSelectMessage}
        onSend={handleScheduledMessageSend}
        onReschedule={handleOpenCalendar}
        onClose={closeMenu}
        onCopyLink={handleCopyLink}
        onCopyMessages={handleCopyMessages}
        onCopyNumber={handleCopyNumber}
        onDownload={handleDownloadClick}
        onSaveGif={handleSaveGif}
        onCancelVote={handleCancelVote}
        onClosePoll={openClosePollDialog}
        onShowSeenBy={handleOpenSeenByModal}
        onToggleReaction={handleToggleReaction}
        onShowReactors={handleOpenReactorListModal}
        onTranslate={handleTranslate}
        onShowOriginal={handleShowOriginal}
        onSelectLanguage={handleSelectLanguage}
        onShare={handleShare}
      />
      <DeleteMessageModal
        isOpen={isDeleteModalOpen}
        isSchedule={messageListType === 'scheduled'}
        onClose={closeDeleteModal}
        album={album}
        message={message}
      />
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={closeReportModal}
        messageIds={reportMessageIds}
      />

      <ShareModal
        messageId={message.id}
        aiAssistantMsgId={aiAssistantMsgId}
        aiUserMsgId={aiUserMsgId}
        chatId={message.chatId}
        isOpen={isShareModalOpen}
        onClose={closeShareModal}
      />
      <PinMessageModal
        isOpen={isPinModalOpen}
        messageId={message.id}
        chatId={message.chatId}
        onClose={closePinModal}
      />
      <ConfirmDialog
        isOpen={isClosePollDialogOpen}
        onClose={closeClosePollDialog}
        text={lang('lng_polls_stop_warning')}
        confirmLabel={lang('lng_polls_stop_sure')}
        confirmHandler={handlePollClose}
      />
      {canReschedule && calendar}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message, messageListType, detectedLanguage }): StateProps => {
    const { threadId } = selectCurrentMessageList(global) || {};
    const activeDownloads = selectActiveDownloadIds(global, message.chatId);
    const chat = selectChat(global, message.chatId);
    const { seenByExpiresAt, seenByMaxChatMembers, maxUniqueReactions } = global.appConfig || {};
    const {
      noOptions,
      canReply,
      canPin,
      canUnpin,
      canDelete,
      canReport,
      canEdit,
      canForward,
      canFaveSticker,
      canUnfaveSticker,
      canCopy,
      canCopyLink,
      canSelect,
      canDownload,
      canSaveGif,
      canRevote,
      canClosePoll,
    } = (threadId && selectAllowedMessageActions(global, message, threadId)) || {};

    const isOwn = isOwnMessage(message);
    const isPinned = messageListType === 'pinned';
    const isScheduled = messageListType === 'scheduled';
    const isChannel = chat && isChatChannel(chat);
    const isLocal = isMessageLocal(message);
    const canShowSeenBy = Boolean(chat
      && seenByMaxChatMembers
      && seenByExpiresAt
      && isChatGroup(chat)
      && isOwn
      && !isScheduled
      && chat.membersCount
      && chat.membersCount <= seenByMaxChatMembers
      && message.date > Date.now() / 1000 - seenByExpiresAt);
    const isPrivate = chat && isUserId(chat.id);
    const isAction = isActionMessage(message);
    const canShowReactionsCount = !isLocal && !isChannel && !isScheduled && !isAction && !isPrivate && message.reactions
      && !areReactionsEmpty(message.reactions) && message.reactions.canSeeList;
    const isProtected = selectIsMessageProtected(global, message);
    const canCopyNumber = Boolean(message.content.contact);
    const isCurrentUserPremium = selectIsCurrentUserPremium(global);

    const customEmojiSetsInfo = selectMessageCustomEmojiSets(global, message);
    const customEmojiSetsNotFiltered = customEmojiSetsInfo?.map((set) => selectStickerSet(global, set));
    const customEmojiSets = customEmojiSetsNotFiltered?.every<ApiStickerSet>(Boolean)
      ? customEmojiSetsNotFiltered : undefined;

    const translationRequestLanguage = selectRequestedTranslationLanguage(global, message.chatId, message.id);
    const hasTranslation = translationRequestLanguage
      ? Boolean(selectMessageTranslations(global, message.chatId, translationRequestLanguage)[message.id]?.text)
      : undefined;

    const { canTranslate: isTranslationEnabled, language, doNotTranslate } = global.settings.byKey;
    const { chatGptAskHistory } = global;
    const history = chatGptAskHistory[message.chatId] || {}
    let aiAssistantMsgId,aiUserMsgId;

    if(history[message.id]){
      aiAssistantMsgId = message.id
      aiUserMsgId = history[message.id]
    }else{
      Object.keys(history).forEach(id=>{
        if(history[id] === message.id){
          aiUserMsgId = message.id
          aiAssistantMsgId = parseInt(id)
        }
      })
    }
    const canTranslateLanguage = !detectedLanguage
      || (!doNotTranslate.includes(detectedLanguage) && language !== detectedLanguage);
    const canTranslate = IS_TRANSLATION_SUPPORTED && isTranslationEnabled && message.content.text
      && canTranslateLanguage && !isLocal && !isScheduled && !isAction && !hasTranslation && !message.emojiOnlyCount;

    return {
      aiAssistantMsgId,
      aiUserMsgId,
      availableReactions: global.availableReactions,
      noOptions,
      canSendNow: isScheduled,
      canReschedule: isScheduled,
      canReply: !isPinned && !isScheduled && canReply,
      canPin: !isScheduled && canPin,
      canUnpin: !isScheduled && canUnpin,
      canDelete,
      canReport,
      canEdit: !isPinned && canEdit,
      canForward: !isScheduled && canForward,
      canFaveSticker: !isScheduled && canFaveSticker,
      canUnfaveSticker: !isScheduled && canUnfaveSticker,
      canCopy: canCopyNumber || (!isProtected && canCopy),
      canCopyLink: !isScheduled && canCopyLink,
      canSelect,
      canDownload: !isProtected && canDownload,
      canSaveGif: !isProtected && canSaveGif,
      canRevote,
      canClosePoll: !isScheduled && canClosePoll,
      activeDownloads,
      canShowSeenBy,
      enabledReactions: chat?.isForbidden ? undefined : chat?.fullInfo?.enabledReactions,
      maxUniqueReactions,
      isPrivate,
      isCurrentUserPremium,
      hasFullInfo: Boolean(chat?.fullInfo),
      canShowReactionsCount,
      canShowReactionList: !isLocal && !isAction && !isScheduled && chat?.id !== SERVICE_NOTIFICATIONS_USER_ID,
      canBuyPremium: !isCurrentUserPremium && !selectIsPremiumPurchaseBlocked(global),
      customEmojiSetsInfo,
      customEmojiSets,
      canScheduleUntilOnline: selectCanScheduleUntilOnline(global, message.chatId),
      threadId,
      canTranslate,
      canShowOriginal: hasTranslation,
      canSelectLanguage: hasTranslation,
    };
  },
)(ContextMenuContainer));
