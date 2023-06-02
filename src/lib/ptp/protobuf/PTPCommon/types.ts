export enum AUTH_TYPE {
  AUTH_TYPE_USERNAME = 0,
  AUTH_TYPE_EMAIL = 1,
  AUTH_TYPE_MOBILE = 2,
}

export enum ChatGptStreamStatus {
  ChatGptStreamStatus_START = 0,
  ChatGptStreamStatus_GOING = 1,
  ChatGptStreamStatus_DONE = 2,
  ChatGptStreamStatus_ERROR = 3,
}

export enum EncryptType {
  EncryptType_Wallet = 0,
  EncryptType_Group = 1,
  EncryptType_Message = 2,
  EncryptType_Media = 3,
}

export enum ERR {
  NO_ERROR = 0,
  ERR_SYSTEM = 1,
  ERR_AUTH_LOGIN = 2,
  ERR_AUTH_NEED = 3,
  ERR_NOT_FOUND = 4,
}

export enum QrCodeType {
  QrCodeType_MNEMONIC = 1,
}

export interface ClientInfo_Type {
  deviceModel: string;
  systemVersion: string;
  appVersion: string;
}

export interface FileInfo_Type {
  id: string;
  size: number;
  part: number;
  part_total?: number;
  buf: Buffer;
  type: string;
}

export interface MessageStoreRow_Type {
  messageId: number;
  buf?: Buffer;
}

export interface MsgRow_Type {
  text: string;
  msgId: number;
  chatId: string;
  senderId: string;
  msgDate: number;
}

export interface PbAction_Type {
  text: string;
  type: string;
}

export interface PbAiBot_Type {
  chatGptConfig?: PbChatGpBotConfig_Type;
  enableAi?: boolean;
  botApi?: string;
  disableClearHistory?: boolean;
  commandsFromApi?: PbCommands_Type[];
}

export interface PbAudio_Type {
  id: string;
  size?: number[];
  duration?: number[];
  mimeType: string;
  fileName: string;
  performer?: string;
  title?: string;
  thumbnailSizes?: PbSizes_Type[];
}

export interface PbBotInfo_Type {
  botId: string;
  description?: string;
  menuButton?: PbMenuButton_Type;
  commands?: PbCommands_Type[];
  photo?: PbPhoto_Type;
  aiBot?: PbAiBot_Type;
}

export interface PbCatBot_Type {
  cat: string;
  userId: string;
  firstName: string;
  avatarHash?: string;
  bio?: string;
  init_system_content?: string;
  welcome?: string;
  outputText?: string;
  template?: string;
  templateSubmit?: string;
  time: number;
}

export interface PbChat_Type {
  type: string;
  id: string;
  title: string;
  usernames?: PbUsernames_Type[];
  isMuted?: boolean;
  isMin?: boolean;
  hasPrivateLink?: boolean;
  isSignaturesShown?: boolean;
  accessHash?: string;
  isVerified?: boolean;
  isJoinToSend?: boolean;
  isJoinRequest?: boolean;
  isForum?: boolean;
  isListed?: boolean;
  settings?: PbSettings_Type;
  lastMessage?: PbMsg_Type;
}

export interface PbChatFolder_Type {
  id: number;
  title: string;
  channels: boolean;
  pinnedChatIds?: string[];
  includedChatIds?: string[];
  excludedChatIds?: string[];
}

export interface PbChatGpBotConfig_Type {
  init_system_content?: string;
  api_key?: string;
  max_history_length?: number;
  modelConfig?: PbChatGptModelConfig_Type;
  welcome?: string;
  template?: string;
  outputText?: string;
  templateSubmit?: string;
}

export interface PbChatGptModelConfig_Type {
  model: string;
  temperature: number;
  max_tokens: number;
  presence_penalty: number;
}

export interface PbCommands_Type {
  botId: string;
  command: string;
  description: string;
}

export interface PbContent_Type {
  text?: PbText_Type;
  photo?: PbPhoto_Type;
  voice?: PbVoice_Type;
  action?: PbAction_Type;
  document?: PbDocument_Type;
  audio?: PbAudio_Type;
}

export interface PbDimensions_Type {
  width: number;
  height: number;
}

export interface PbDocument_Type {
  id?: string;
  fileName: string;
  size?: number[];
  timestamp?: number;
  duration?: number[];
  mimeType: string;
  performer?: string;
  previewBlobUrl?: string;
  mediaType?: string;
  mediaSize?: PbSizes_Type;
  thumbnail?: PbThumbnail_Type;
}

export interface PbFullInfo_Type {
  bio?: string;
  commonChatsCount?: number;
  isBlocked?: boolean;
  noVoiceMessages?: boolean;
  botInfo?: PbBotInfo_Type;
  pinnedMessageId?: number;
}

export interface PbMenuButton_Type {
  type: string;
  text?: string;
  url?: string;
}

export interface PbMessageEntity_Type {
  type: string;
  offset: number;
  length: number;
  documentId?: string;
  userId?: string;
  url?: string;
  language?: string;
  cipher?: string;
  hint?: string;
}

export interface PbMsg_Type {
  id: number;
  chatId: string;
  content: PbContent_Type;
  date: number;
  isOutgoing: boolean;
  senderId?: string;
  isForwardingAllowed?: boolean;
  previousLocalId?: number;
  views?: number;
  repliesThreadInfo?: PbRepliesThreadInfo_Type;
  reactions?: PbReactions_Type;
  replyToMessageId?: number;
  replyToUserId?: string;
}

export interface PbPhoto_Type {
  id: string;
  thumbnail?: PbThumbnail_Type;
  sizes?: PbSizes_Type[];
  isSpoiler?: boolean;
}

export interface PbQrCode_Type {
  type: QrCodeType;
  data: Buffer;
}

export interface PbReaction_Type {
  emoticon: string;
}

export interface PbReactionCount_Type {
  chosenOrder?: number;
  count: number;
  reaction: PbReaction_Type;
}

export interface PbReactions_Type {
  canSeeList?: boolean;
  results?: PbReactionCount_Type[];
}

export interface PbRepliesThreadInfo_Type {
  isComments: boolean;
  threadId: number;
  chatId: string;
  originChannelId: string;
  messagesCount: number;
  lastMessageId: number;
  recentReplierIds?: string[];
}

export interface PbSettings_Type {
  isAutoArchived?: boolean;
  canReportSpam?: boolean;
  canAddContact?: boolean;
  canBlockContact?: boolean;
}

export interface PbSizes_Type {
  width: number;
  height: number;
  type: string;
}

export interface PbText_Type {
  text: string;
  entities?: PbMessageEntity_Type[];
}

export interface PbThumbnail_Type {
  width: number;
  height: number;
  dataUri: string;
}

export interface PbUser_Type {
  id: string;
  firstName?: string;
  usernames?: PbUsernames_Type[];
  isMin?: boolean;
  isPremium?: boolean;
  type: string;
  hasVideoAvatar?: boolean;
  canBeInvitedToGroup?: boolean;
  phoneNumber: string;
  noStatus?: boolean;
  accessHash?: string;
  fullInfo?: PbFullInfo_Type;
  lastName?: string;
  isSelf?: boolean;
  avatarHash?: string;
  photos?: PbPhoto_Type[];
  updatedAt?: number;
}

export interface PbUsernames_Type {
  username: string;
  isActive?: boolean;
  isEditable?: boolean;
}

export interface PbVoice_Type {
  id: string;
  waveform?: number[];
  duration?: number;
}

export interface UserMessageStoreData_Type {
  chatId: string;
  messageIds?: number[];
  messageIdsDeleted?: number[];
  time: number;
}

export interface UserStoreData_Type {
  chatIds?: string[];
  chatIdsDeleted?: string[];
  chatFolders?: string;
  time?: number;
  myBots?: string[];
  myGroups?: string[];
}

export interface UserStoreRow_Type {
  buf?: Buffer;
  userId: string;
  time?: number;
  user?: PbUser_Type;
}

