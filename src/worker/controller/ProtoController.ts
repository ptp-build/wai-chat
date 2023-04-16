import {Pdu,} from '../../lib/ptp/protobuf/BaseMsg';
import {ActionCommands, getActionCommandsName} from '../../lib/ptp/protobuf/ActionCommands';
import {Download, Upload} from '../share/service/File';
import {DownloadMsgReq, DownloadMsgRes, UploadMsgReq, UploadMsgRes} from '../../lib/ptp/protobuf/PTPMsg';
import {
  ERR,
  MessageStoreRow_Type,
  UserMessageStoreData_Type, UserStoreData_Type,
  UserStoreRow_Type,
} from '../../lib/ptp/protobuf/PTPCommon/types';
import Account from '../share/Account';
import {ENV, kv, storage} from '../env';
import {genUserId} from '../share/service/User';
import {
  DownloadUserReq,
  DownloadUserRes,
  GenUserIdReq,
  GenUserIdRes,
  UploadUserReq,
  UploadUserRes
} from "../../lib/ptp/protobuf/PTPUser";
import WaiOpenAPIRoute from "../share/cls/WaiOpenAPIRoute";
import {SyncReq, SyncRes} from "../../lib/ptp/protobuf/PTPSync";
import {UserMessageStoreData, UserStoreData} from "../../lib/ptp/protobuf/PTPCommon";


export default class ProtoController extends WaiOpenAPIRoute{
  static schema = {
    tags: ['Proto'],
    parameters: {

    },
    responses: {
      '200': {
        schema: {},
      },
    },
  };

  // @ts-ignore
  async handle(request: Request, data: Record<string, any>) {
    return await this.dispatch(request)
  }

	async dispatch(request: Request) {
		try {
			const arrayBuffer = await request.arrayBuffer();
			let pdu = new Pdu(Buffer.from(arrayBuffer));
			switch (pdu.getCommandId()) {
				case ActionCommands.CID_DownloadReq:
					return Download(pdu);
				default:
					break;
			}

			const auth = request.headers.get('Authorization');
			if (!auth) {
        return WaiOpenAPIRoute.responseError("not auth",401)
			}
			const token = auth.replace('Bearer ', '');
			if (token.indexOf('_') === -1) {
        return WaiOpenAPIRoute.responseError("not auth",401)
			}
			const res = token.split('_');
      const sign = res[0]
      const ts = res[1]
			const account = new Account(1);
			const { address } = account.recoverAddressAndPubKey(
				Buffer.from(sign, 'hex'),
				ts.toString()
			);
			if (!address) {
        return WaiOpenAPIRoute.responseError("not auth",401)
			}
			Account.setServerKv(kv);
			let authUserId = await account.getUidFromCacheByAddress(address);
			if (!authUserId) {
				authUserId = await genUserId();
				await account.saveUidFromCacheByAddress(address, authUserId);
			}
      console.log("auth",authUserId,address)
			console.debug('[Proto Req]', authUserId,address, pdu.getCommandId(),getActionCommandsName(pdu.getCommandId()));

			switch (pdu.getCommandId()) {
        case ActionCommands.CID_SyncReq:
          return this.handleSyncReq(Number(authUserId), pdu);
        case ActionCommands.CID_UploadUserReq:
          return this.handleUploadUserReq(Number(authUserId), pdu);
        case ActionCommands.CID_DownloadUserReq:
          return this.handleDownloadUserReq(Number(authUserId), pdu);
        case ActionCommands.CID_UploadMsgReq:
          return this.handleUploadMsgReq(Number(authUserId), pdu);
        case ActionCommands.CID_DownloadMsgReq:
          return this.handleDownloadMsgReq(Number(authUserId), pdu);
				case ActionCommands.CID_UploadReq:
					return Upload(pdu);
				default:
					break;
			}
		} catch (e) {
			// @ts-ignore
      console.error(e.stack);
			// @ts-ignore
      return WaiOpenAPIRoute.responseError(ENV.IS_PROD ? "System Error":e.stack.split("\n"))
		}
	}

  async handleSyncReq(authUserId: number, pdu: Pdu) {
    const {userStoreData} = SyncReq.parseMsg(pdu);
    const userStoreDataStr = await kv.get(`W_U_S_D_${authUserId}`);
    let userStoreDataRes:UserStoreData_Type;
    if(userStoreDataStr){
      const buf = Buffer.from(userStoreDataStr,'hex')
      userStoreDataRes = UserStoreData.parseMsg(new Pdu(buf))

      if(userStoreData?.chatIdsDeleted){
        userStoreData.chatIdsDeleted.forEach(id=>{
          if(!userStoreDataRes.chatIdsDeleted){
            userStoreDataRes.chatIdsDeleted = []
          }
          if(!userStoreDataRes.chatIdsDeleted.includes(id)){
            userStoreDataRes.chatIdsDeleted.push(id)
          }
        })
      }

      if(userStoreData?.chatIds){
        userStoreData.chatIds.forEach(id=>{
          if(!userStoreDataRes.chatIds){
            userStoreDataRes.chatIds = []
          }
          if(!userStoreDataRes.chatIdsDeleted){
            userStoreDataRes.chatIdsDeleted = []
          }
          if(!userStoreDataRes.chatIds.includes(id) && !userStoreDataRes.chatIdsDeleted.includes(id)){
            userStoreDataRes.chatIds.push(id)
          }
        })
      }
      if(userStoreData?.chatFolders){
        userStoreDataRes.chatFolders = userStoreData?.chatFolders
      }
    }else{
      userStoreDataRes = userStoreData!
    }
    await kv.put(`W_U_S_D_${authUserId}`,Buffer.from(new UserStoreData(userStoreDataRes).pack().getPbData()).toString("hex"));

    return WaiOpenAPIRoute.responsePdu(
      new SyncRes({
        userStoreData:userStoreDataRes,
        err: ERR.NO_ERROR,
      }).pack()
    )
  }
  async handleUploadMsgReq (authUserId: number, pdu: Pdu) {
    const {messages,chatId} = UploadMsgReq.parseMsg(pdu);
    const messageStorageDataStr = await kv.get(`W_M_S_D_${authUserId}_${chatId}`);

    let messageStorageData:UserMessageStoreData_Type = {
      time: Math.ceil(+(new Date())/1000),
      chatId,
      messageIds:[],
      messageIdsDeleted:[]
    };
    if(messageStorageDataStr){
      messageStorageData = UserMessageStoreData.parseMsg(new Pdu(Buffer.from(messageStorageDataStr,'hex')))
    }
    console.log("[handleUploadMsgReq]",messageStorageData,messages)
    if(messages){
      for (let i = 0; i < messages?.length; i++) {
        if (messages) {
          const {buf, messageId} = messages[i];
          if(!messageStorageData.messageIds?.includes(messageId)){
            messageStorageData.messageIds?.push(messageId)
          }
          await storage.put(
            `wai/${authUserId}/messages/${chatId}/${messageId}`,
            Buffer.from(buf!)
          );
        }
      }
      await kv.put(
        `W_M_S_D_${authUserId}_${chatId}`,
        Buffer.from(
          new UserMessageStoreData(messageStorageData).pack().getPbData()
        ).toString("hex"))
      ;
    }
    return WaiOpenAPIRoute.responsePdu(
      new UploadMsgRes({
        err: ERR.NO_ERROR,
      }).pack()
    )
  }

  async handleDownloadMsgReq (authUserId: number, pdu: Pdu) {
    const {chatId} = DownloadMsgReq.parseMsg(pdu);
    const messages:MessageStoreRow_Type[] = []
    const messageStorageDataStr = await kv.get(`W_M_S_D_${authUserId}_${chatId}`);
    if(messageStorageDataStr){
      const {messageIds,messageIdsDeleted} = UserMessageStoreData.parseMsg(new Pdu(Buffer.from(messageStorageDataStr,'hex')))
      console.log("[handleDownloadMsgReq]",chatId,{messageIds,messageIdsDeleted})
      if(messageIds){
        for (let i = 0; i < messageIds?.length; i++) {
          const messageId = messageIds[i];
          if(messageIdsDeleted?.includes(messageId)){
            continue
          }
          const res = await storage.get(
            `wai/${authUserId}/messages/${chatId}/${messageId}`,
          );
          messages.push({
            messageId,
            buf:Buffer.from(res!)
          })
        }
      }
    }
    console.log("messages:",messages)
    return WaiOpenAPIRoute.responsePdu(
      new DownloadMsgRes({
        messages,
        err: ERR.NO_ERROR,
      }).pack()
    )
  }

  async handleUploadUserReq (authUserId: number, pdu: Pdu) {
    const {users} = UploadUserReq.parseMsg(pdu);

    if(users){
      for (let i = 0; i < users?.length; i++) {
        if (users) {
          const {buf, userId} = users[i];
          await storage.put(
            `wai/${authUserId}/users/${userId}`,
            Buffer.from(buf!)
          );
          console.log(`userId:${userId}`)
          console.log(buf)
        }
      }
    }

    return WaiOpenAPIRoute.responsePdu(
      new UploadUserRes({
        err: ERR.NO_ERROR,
      }).pack()
    )
  }

  async handleDownloadUserReq (authUserId: number, pdu: Pdu) {
    const {userIds} = DownloadUserReq.parseMsg(pdu);
    const users:UserStoreRow_Type[] = []
    if(userIds){
      for (let i = 0; i < userIds?.length; i++) {
        const userId = userIds![i]
        const res = await storage.get(
          `wai/${authUserId}/users/${userId}`,
        );
        users.push({
          userId,
          buf:Buffer.from(res!)
        })
      }
    }

    return WaiOpenAPIRoute.responsePdu(
      new DownloadUserRes({
        users,
        err: ERR.NO_ERROR,
      }).pack()
    )
  }

  async handleGenUserIdReq (authUserId: number, pdu: Pdu) {
    const res = GenUserIdReq.parseMsg(pdu);
    console.debug('[handleGenUserIdReq]', res);
    const userIdStr = await kv.get('W_U_INCR_' + authUserId,true);
    let userId = parseInt(ENV.USER_ID_START);
    if(userIdStr){
      userId = parseInt(userIdStr) + 1
    }else{
      userId += 1
    }
    await kv.put('W_U_INCR_' + authUserId,userId.toString());
    return WaiOpenAPIRoute.responsePdu(
      new GenUserIdRes({
        userId,
        err: ERR.NO_ERROR,
      })
        .pack()
    )
  }
}
