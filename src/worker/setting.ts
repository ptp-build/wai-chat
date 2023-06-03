import {PbChatGptModelConfig_Type} from "../lib/ptp/protobuf/PTPCommon/types";

export const DEFAULT_LANG_MNEMONIC = "chinese_simplified"
export const SERVER_USER_ID_START = "20000000"
export const SERVER_BOT_USER_ID_START = "10000000"

export const UserIdFirstBot = "1000";
export const UserIdChatGpt = "1012";

export const DEFAULT_AVATARS:Record<string, string> = {
  ["1"]:'0100/waiUser.png',
  [UserIdFirstBot]:'0100/wai.png',
  [UserIdChatGpt]:'0100/ChatGPT.png',
}

export const NameFirstBot = "Wai";
export const DEFAULT_CREATE_USER_BIO = '我是一个AI机器人'
export const DEFAULT_WAI_USER_BIO = '我是一名基于 Ai 的助手'
export const DEFAULT_PROMPT = ''
export const BOT_FOLDER_TITLE = 'Wai'
export const BOT_FOLDER_ID = 1

export const WaterMark = 'https://wai.chat'

export const PASSWORD_MSG_HELPER = `
- 账户密码 可结合 助记词 用来跨设备登录
- 账户密码 可用来加密所需的消息
- 账户密码 和 助记词 不会存服务端，请牢记 账户密码 和妥善安全保存助记词！！

如何查看助记词：
- 发送 /setting
- 点击 切换账户
`

export const ALL_CHAT_GPT_MODELS = [
  {
    name: "gpt-4",
    available: true,
  },
  {
    name: "gpt-3.5-turbo",
    available: true,
  },
];

export const ChatModelConfig:PbChatGptModelConfig_Type = {
  model: "gpt-3.5-turbo",
  temperature: 0.5,
  max_tokens: 1000,
  presence_penalty: 0,
}

export const DEFAULT_BOT_NO_AI_COMMANDS = [
  {
    "command": "start",
    "description": "开始对话"
  },
  {
    "command": "setting",
    "description": "设置面板"
  },
  {
    "command": "help",
    "description": "帮助"
  },

]

export const DEFAULT_BOT_AI_COMMANDS = [
  ...DEFAULT_BOT_NO_AI_COMMANDS,
  // {
  //   "command": "prompts",
  //   "description": "Prompts 大全"
  // },
  {
    "command": "usage",
    "description": "账户余额"
  },
  {
    "command": "ai",
    "description": "AI设置"
  },
]


export const CurrentUserInfo = {
  "id": "1",
  "accessHash": "",
  "firstName": "Me",
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
      "username": "me",
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
        "bio": DEFAULT_WAI_USER_BIO,
        "botInfo": {
          aiBot:{
            enableAi:false,
            chatGptConfig:{
              modelConfig:ChatModelConfig,
              api_key:"",
              init_system_content:DEFAULT_PROMPT,
              max_history_length:0,
            },
          },
          "botId": UserIdFirstBot,
          "description": DEFAULT_WAI_USER_BIO,
          "menuButton": {
            "type": "commands"
          },
          "commands": DEFAULT_BOT_AI_COMMANDS
        }
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
          "username": "wai",
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
    }
  ],
  folderIds:[
    0,
    BOT_FOLDER_ID,
  ],
  "draftsById": {},
  "replyingToById": {},
  "orderedPinnedIds": [],
}
export const TEXT_AI_THINKING = "..."
export const BYPASS_API = [
  "translateText",
  "editChatFolder","sortChatFolders","deleteChatFolder",
  "requestWebView","uploadContactProfilePhoto",
  "sendMessage","editMessage","deleteMessages","downloadMedia","destroy","fetchMessages","answerCallbackButton",
  "uploadProfilePhoto","fetchChats","sendWithCallback","msgClientLogin","updateProfile","updateUsername"
]

export const STOP_HANDLE_MESSAGE = true
// export const TopCats = require("./assets/topCats-cn.json")
export const TopCats = {}
