import {PbChatGptModelConfig_Type} from "../lib/ptp/protobuf/PTPCommon/types";

export const UserIdFirstBot = "1000";
export const UserIdCnPrompt = "1010";
export const UserIdEnPrompt = "1011";
export const UserIdChatGpt = "1012";
export const UserIdChatGpt4 = "1013";

export const DEFAULT_AVATARS:Record<string, string> = {
  [UserIdFirstBot]:'icon-square-dev-512x512.png',
  [UserIdChatGpt]:'avatar/ChatGPT_logo.png',
  [UserIdChatGpt4]:'avatar/chatgpt4.png'
}

export const NameFirstBot = "Wai";
export const DEFAULT_CREATE_USER_BIO = '我是一个AI机器人'
export const DEFAULT_PROMPT = '你现在是一个优秀的助手，请用中文回答我的问题。'
export const BOT_FOLDER_TITLE = 'Wai'
export const BOT_FOLDER_ID = 1


const ENABLE_GPT4 = true;

export const ALL_CHAT_GPT_MODELS = [
  {
    name: "gpt-4",
    available: ENABLE_GPT4,
  },
  // {
  //   name: "gpt-4-0314",
  //   available: ENABLE_GPT4,
  // },
  // {
  //   name: "gpt-4-32k",
  //   available: ENABLE_GPT4,
  // },
  // {
  //   name: "gpt-4-32k-0314",
  //   available: ENABLE_GPT4,
  // },
  {
    name: "gpt-3.5-turbo",
    available: true,
  },
  // {
  //   name: "gpt-3.5-turbo-0301",
  //   available: true,
  // },
];

export const ChatModelConfig:PbChatGptModelConfig_Type = {
  model: "gpt-3.5-turbo",
  temperature: 1,
  max_tokens: 2000,
  presence_penalty: 0,
}

export const DEFAULT_BOT_COMMANDS = [
  {
    "botId": UserIdFirstBot,
    "command": "start",
    "description": "开始对话"
  },
  {
    "botId": UserIdFirstBot,
    "command": "setting",
    "description": "设置面板"
  },
]

export const DEFAULT_CHATGPT_AI_COMMANDS = [
  {
    "botId": UserIdChatGpt,
    "command": "reset",
    "description": "重置ai记忆,提问只携带 初始化Prompt"
  },
  {
    "botId": UserIdChatGpt,
    "command": "aiModel",
    "description": "设置AI模型"
  },
  {
    "botId": UserIdChatGpt,
    "command": "apiKey",
    "description": "自定义apiKey"
  },
  {
    "botId": UserIdChatGpt,
    "command": "systemPrompt",
    "description": "初始化 上下文 Prompt"
  },
  {
    "botId": UserIdChatGpt,
    "command": "maxHistoryLength",
    "description": "每次提问携带历史消息数"
  },
  {
    "botId": UserIdChatGpt,
    "command": "usage",
    "description": "账户余额"
  },
]

export const DEFAULT_START_TIPS =    `你可以通过发送以下命令来控制我：

/setting - 设置面板

`

export const CurrentUserInfo = {
  "id": "1",
  "accessHash": "",
  "firstName": "",
  "lastName": "",
  "canBeInvitedToGroup": false,
  "hasVideoAvatar": false,
  "isMin": false,
  "isPremium": false,
  "noStatus": true,
  "fullInfo": {
    "isBlocked": false,
    "noVoiceMessages": false,
    "bio": "",
  },
  "usernames": [
    {
      "username": "my-self",
      "isActive": true,
      "isEditable": true
    }
  ],
  "type": "userTypeBot",
  "phoneNumber": "",
  "avatarHash": "",
  "isSelf": true
}

export let LoadAllChats = {
  "users": [
    {...CurrentUserInfo},
    {
      "id": UserIdFirstBot,
      "fullInfo": {
        "isBlocked": false,
        "noVoiceMessages": false,
        "bio": DEFAULT_CREATE_USER_BIO,
        "botInfo": {
          "botId": UserIdFirstBot,
          "description": DEFAULT_CREATE_USER_BIO,
          aiType:"ChatGpt",
          "menuButton": {
            "type": "commands"
          },
          "commands": DEFAULT_BOT_COMMANDS
        }
      },
      bot:{
        chatGptConfig:{
          modelConfig:ChatModelConfig,
          api_key:"",
          init_system_content:DEFAULT_PROMPT,
          max_history_length:4,
        },
        enableAi:true,
      },
      "accessHash": "",
      "firstName": NameFirstBot,
      "lastName": "",
      "canBeInvitedToGroup": false,
      "hasVideoAvatar": false,
      "isMin": false,
      "isPremium": true,
      "noStatus": true,
      "usernames": [
        {
          "username": "first_bot",
          "isActive": true,
          "isEditable": true
        }
      ],
      "type": "userTypeBot",
      "phoneNumber": "",
      "avatarHash": "",
      "isSelf": false
    }
  ],
  "chats": [
    {
      "id": UserIdFirstBot,
      "title":  NameFirstBot,
      "type": "chatTypePrivate",
      "isMuted": false,
      "isMin": false,
      "hasPrivateLink": false,
      "isSignaturesShown": false,
      "isVerified": true,
      "isJoinToSend": true,
      "isJoinRequest": true,
      "isForum": false,
      "isListed": true,
      "settings": {
        "isAutoArchived": false,
        "canReportSpam": false,
        "canAddContact": false,
        "canBlockContact": false
      },
      "accessHash": ""
    }
  ],
  "chatFolders": [
    {
      "id": BOT_FOLDER_ID,
      "title": BOT_FOLDER_TITLE,
      "includedChatIds": [
        UserIdFirstBot
      ],
      "channels": false,
      "pinnedChatIds": [],
      "excludedChatIds": []
    },
    {
      "id": 2,
      "title": "ChatGpt",
      "includedChatIds": [
        UserIdChatGpt,UserIdChatGpt4
      ],
      "channels": false,
      "pinnedChatIds": [],
      "excludedChatIds": []
    }
  ],
  folderIds:[
    0,
    BOT_FOLDER_ID,
    2
  ],
  "draftsById": {},
  "replyingToById": {},
  "orderedPinnedIds": [],
}
export const TEXT_AI_THINKING = "..."
export const BYPASS_API = [
  "editChatFolder","sortChatFolders","deleteChatFolder",
  "requestWebView","uploadContactProfilePhoto",
  "sendMessage","editMessage","deleteMessages","downloadMedia","destroy","fetchMessages","answerCallbackButton",
  "uploadProfilePhoto","fetchChats","sendWithCallback","msgClientLogin","updateProfile","updateUsername"
]

export const BOTTOM_INPUT_LEFT_MARGIN = 'width:4px;'

export const STOP_HANDLE_MESSAGE = true
