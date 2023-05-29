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
export const DEFAULT_WAI_USER_BIO = '基于 chatGpt的Ai助手'
export const DEFAULT_PROMPT = ''
export const BOT_FOLDER_TITLE = 'Wai'
export const BOT_FOLDER_ID = 1

export const WaterMark = 'https://wai.chat'

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

export const DEFAULT_FIRST_BOT_COMMANDS = [
  {
    "command": "start",
    "description": "开始对话"
  },
  {
    "command": "setting",
    "description": "设置面板"
  },
]


export const DEFAULT_BOT_COMMANDS = [
  {
    "command": "start",
    "description": "开始对话"
  },
  {
    "command": "setting",
    "description": "设置面板"
  },
  {
    "command": "welcome",
    "description": "欢迎语"
  },
  {
    "command": "help",
    "description": "帮助"
  },
]
export const DEFAULT_CHATGPT_AI_COMMANDS = [
  {
    "command": "reset",
    "description": "重置ai记忆,提问只携带 初始化Prompt"
  },
  {
    "command": "template",
    "description": "提问示例"
  },
  {
    "command": "templateSubmit",
    "description": "提问模版"
  },
  {
    "command": "aiModel",
    "description": "设置AI模型"
  },
  {
    "command": "apiKey",
    "description": "自定义apiKey"
  },
  {
    "command": "systemPrompt",
    "description": "系统 Prompt"
  },
  {
    "command": "maxHistoryLength",
    "description": "每次提问携带历史消息数"
  },
  {
    "command": "usage",
    "description": "账户余额"
  },
]

export const DEFAULT_START_TIPS = `您好，我是基于chatGpt的Ai小助手

您可以向我提问，我很乐意为您解答问题！

您也可以通过发送以下命令来控制我：

⚪ /setting - 设置面板
`

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
            enableAi:true,
            chatGptConfig:{
              modelConfig:ChatModelConfig,
              api_key:"",
              init_system_content:DEFAULT_PROMPT,
              max_history_length:0,
            },
          },
          "botId": UserIdFirstBot,
          "description": DEFAULT_CREATE_USER_BIO,
          "menuButton": {
            "type": "commands"
          },
          "commands": DEFAULT_FIRST_BOT_COMMANDS
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
export const TopCats = require("./assets/topCats-cn.json")
