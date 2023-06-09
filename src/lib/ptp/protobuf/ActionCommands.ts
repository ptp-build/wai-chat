export enum ActionCommands {
  CID_AuthLoginReq = 1001,
  CID_AuthLoginRes = 1002,
  CID_AuthNativeReq = 1003,
  CID_AuthNativeRes = 1004,
  CID_AuthPreLoginReq = 1005,
  CID_AuthPreLoginRes = 1006,
  CID_AuthStep1Req = 1007,
  CID_AuthStep1Res = 1008,
  CID_AuthStep2Req = 1009,
  CID_AuthStep2Res = 1010,
  CID_InitAppRes = 1011,
  CID_UpdateProfileReq = 1012,
  CID_UpdateProfileRes = 1013,
  CID_UpdateUsernameReq = 1014,
  CID_UpdateUsernameRes = 1015,
  CID_UploadProfilePhotoReq = 1016,
  CID_UploadProfilePhotoRes = 1017,
  CID_LoadChatsReq = 2001,
  CID_LoadChatsRes = 2002,
  CID_DownloadReq = 3001,
  CID_DownloadRes = 3002,
  CID_UploadReq = 3003,
  CID_UploadRes = 3004,
  CID_CallbackButtonReq = 4001,
  CID_CallbackButtonRes = 4002,
  CID_DownloadMsgReq = 4003,
  CID_DownloadMsgRes = 4004,
  CID_GenMsgIdReq = 4005,
  CID_GenMsgIdRes = 4006,
  CID_MsgListReq = 4007,
  CID_MsgListRes = 4008,
  CID_MsgReq = 4009,
  CID_MsgRes = 4010,
  CID_RemoveMessagesReq = 4011,
  CID_RemoveMessagesRes = 4012,
  CID_SendBotMsgReq = 4013,
  CID_SendBotMsgRes = 4014,
  CID_SendMsgRes = 4015,
  CID_SendTextMsgReq = 4016,
  CID_UpdateCmdReq = 4017,
  CID_UpdateCmdRes = 4018,
  CID_UploadMsgReq = 4019,
  CID_UploadMsgRes = 4020,
  CID_OtherNotify = 5001,
  CID_StopChatStreamReq = 5002,
  CID_SyncReq = 6001,
  CID_SyncRes = 6002,
  CID_TopCatsReq = 6003,
  CID_TopCatsRes = 6004,
  CID_CreateUserReq = 7001,
  CID_CreateUserRes = 7002,
  CID_DownloadUserReq = 7003,
  CID_DownloadUserRes = 7004,
  CID_FetchBotSettingReq = 7005,
  CID_FetchBotSettingRes = 7006,
  CID_GenUserIdReq = 7007,
  CID_GenUserIdRes = 7008,
  CID_SaveBotSettingReq = 7009,
  CID_SaveBotSettingRes = 7010,
  CID_ShareBotReq = 7011,
  CID_ShareBotRes = 7012,
  CID_ShareBotStopReq = 7013,
  CID_ShareBotStopRes = 7014,
  CID_UploadUserReq = 7015,
  CID_UploadUserRes = 7016,
}

export const ActionCommandsName = {
  1001: "CID_AuthLoginReq",
  1002: "CID_AuthLoginRes",
  1003: "CID_AuthNativeReq",
  1004: "CID_AuthNativeRes",
  1005: "CID_AuthPreLoginReq",
  1006: "CID_AuthPreLoginRes",
  1007: "CID_AuthStep1Req",
  1008: "CID_AuthStep1Res",
  1009: "CID_AuthStep2Req",
  1010: "CID_AuthStep2Res",
  1011: "CID_InitAppRes",
  1012: "CID_UpdateProfileReq",
  1013: "CID_UpdateProfileRes",
  1014: "CID_UpdateUsernameReq",
  1015: "CID_UpdateUsernameRes",
  1016: "CID_UploadProfilePhotoReq",
  1017: "CID_UploadProfilePhotoRes",
  2001: "CID_LoadChatsReq",
  2002: "CID_LoadChatsRes",
  3001: "CID_DownloadReq",
  3002: "CID_DownloadRes",
  3003: "CID_UploadReq",
  3004: "CID_UploadRes",
  4001: "CID_CallbackButtonReq",
  4002: "CID_CallbackButtonRes",
  4003: "CID_DownloadMsgReq",
  4004: "CID_DownloadMsgRes",
  4005: "CID_GenMsgIdReq",
  4006: "CID_GenMsgIdRes",
  4007: "CID_MsgListReq",
  4008: "CID_MsgListRes",
  4009: "CID_MsgReq",
  4010: "CID_MsgRes",
  4011: "CID_RemoveMessagesReq",
  4012: "CID_RemoveMessagesRes",
  4013: "CID_SendBotMsgReq",
  4014: "CID_SendBotMsgRes",
  4015: "CID_SendMsgRes",
  4016: "CID_SendTextMsgReq",
  4017: "CID_UpdateCmdReq",
  4018: "CID_UpdateCmdRes",
  4019: "CID_UploadMsgReq",
  4020: "CID_UploadMsgRes",
  5001: "CID_OtherNotify",
  5002: "CID_StopChatStreamReq",
  6001: "CID_SyncReq",
  6002: "CID_SyncRes",
  6003: "CID_TopCatsReq",
  6004: "CID_TopCatsRes",
  7001: "CID_CreateUserReq",
  7002: "CID_CreateUserRes",
  7003: "CID_DownloadUserReq",
  7004: "CID_DownloadUserRes",
  7005: "CID_FetchBotSettingReq",
  7006: "CID_FetchBotSettingRes",
  7007: "CID_GenUserIdReq",
  7008: "CID_GenUserIdRes",
  7009: "CID_SaveBotSettingReq",
  7010: "CID_SaveBotSettingRes",
  7011: "CID_ShareBotReq",
  7012: "CID_ShareBotRes",
  7013: "CID_ShareBotStopReq",
  7014: "CID_ShareBotStopRes",
  7015: "CID_UploadUserReq",
  7016: "CID_UploadUserRes",
};

export const getActionCommandsName = (cid:ActionCommands)=>{
   return ActionCommandsName[cid] || cid.toString();
}

