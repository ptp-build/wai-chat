import MsgDispatcher from "./MsgDispatcher";
import {selectChatMessage, selectChatMessages, selectUser} from "../../global/selectors";
import {addChats, addUsers, updateChatListIds, updateUser} from "../../global/reducers";
import {getActions, getGlobal, setGlobal} from "../../global";
import {ApiKeyboardButtons} from "../../api/types";
import {callApiWithPdu} from "./utils";
import {currentTs} from "../share/utils/utils";
import {
  MessageStoreRow_Type,
  PbMsg_Type,
  QrCodeType,
  UserStoreData_Type,
  UserStoreRow_Type
} from "../../lib/ptp/protobuf/PTPCommon/types";
import {DownloadMsgReq, DownloadMsgRes, UploadMsgReq} from "../../lib/ptp/protobuf/PTPMsg";
import {DownloadUserReq, DownloadUserRes, UploadUserReq} from "../../lib/ptp/protobuf/PTPUser";
import Mnemonic from "../../lib/ptp/wallet/Mnemonic";
import Account from "../share/Account";
import {AuthNativeReq} from "../../lib/ptp/protobuf/PTPAuth";
import {GlobalState} from "../../global/types";
import {getPasswordFromEvent} from "../share/utils/password";
import {hashSha256} from "../share/utils/helpers";
import {SyncReq, SyncRes} from "../../lib/ptp/protobuf/PTPSync";
import MsgCommand from "./MsgCommand";
import {Decoder} from "@nuintun/qrcode";
import {PbQrCode} from "../../lib/ptp/protobuf/PTPCommon";
import {Pdu} from "../../lib/ptp/protobuf/BaseMsg";
import {aesDecrypt} from "../../util/passcode";
import {CLOUD_MESSAGE_API} from "../../config";
import {DEFAULT_BOT_COMMANDS, DEFAULT_START_TIPS, UserIdFirstBot} from "../setting";
import ChatMsg from "./ChatMsg";

let currentSyncBotContext:string|undefined;

export default class MsgCommandSetting{
  private chatId: string;
  private chatMsg:ChatMsg
  constructor(chatId:string) {
    this.chatId = chatId;
    this.chatMsg = new ChatMsg(chatId)
  }
  async start(){
    const {chatId} = this;
    await new MsgCommand(chatId).reloadCommands(DEFAULT_BOT_COMMANDS)
    return this.chatMsg.setText(DEFAULT_START_TIPS).reply()
  }

  async setting() {
    const {chatId} = this;
    await new MsgCommand(chatId).reloadCommands(DEFAULT_BOT_COMMANDS)
    return  this.chatMsg.setText("设置面板")
      .setInlineButtons(this.getInlineButtons())
      .reply()
  }

  getInlineButtons():ApiKeyboardButtons{
    const {chatId} = this;
    const res:ApiKeyboardButtons = []
    res.push([
      {
        text:"切换账户",
        data:`${chatId}/setting/switchAccount`,
        type:"callback"
      },
    ])
    if(CLOUD_MESSAGE_API){
      res.push([
        {
          text:"云同步",
          data:`${chatId}/setting/cloud`,
          type:"callback"
        },
        {
          text:"清除历史记录",
          data:`${chatId}/setting/clearHistory`,
          type:"callback"
        },
      ])
    }else{
      res.push([
        {
          text:"清除历史记录",
          data:`${chatId}/setting/clearHistory`,
          type:"callback"
        },
      ])
    }
    res.push([
      {
        text:"生成签名",
        data:`${chatId}/setting/signGen`,
        type:"callback"
      },
    ])
    res.push([
      {
        data:`${chatId}/setting/cancel`,
        text:"取消",
        type:"callback"
      },
    ])
    return res;
  }

  async requestUploadImage(global:GlobalState,messageId:number,files:FileList | null){
    const {chatId} = this
    if(files && files.length > 0){
      const file = files[0]
      const qrcode = new Decoder();
      const blob = new Blob([file], { type: file.type });
      const blobUrl = URL.createObjectURL(blob);
      try {
        const result = await qrcode.scan(blobUrl)
        if(result && result.data.startsWith('wai://')){
          const mnemonic =  result.data
          const qrcodeData = mnemonic.replace('wai://','')
          const qrcodeDataBuf = Buffer.from(qrcodeData,'hex')
          const decodeRes = PbQrCode.parseMsg(new Pdu(qrcodeDataBuf))
          if(decodeRes){
            const {type,data} = decodeRes;
            if(type !== QrCodeType.QrCodeType_MNEMONIC){
              throw new Error("解析二维码失败")
            }
            const {password} = await getPasswordFromEvent(undefined,true);
            const res = await aesDecrypt(data,Buffer.from(hashSha256(password),"hex"))
            if(res){
              await this.setMnemonic(res,password);
              return;
            }
          }
        }
      }catch (e){
      }finally {
        getActions().showNotification({message:"解析二维码失败"})
      }
    }
  }

  async setMnemonic(data:string,password?:string){
    const mnemonic = new Mnemonic(data)
    if(mnemonic.checkMnemonic()){
      if(!password){
        const res = await getPasswordFromEvent(undefined,true)
        if(res.password){
          password = res.password
        }else{
          return
        }
      }
      if(password){
        const entropy = mnemonic.toEntropy();
        let accountId = Account.getAccountIdByEntropy(entropy);
        if(!accountId){
          accountId = Account.genAccountId()
        }
        const account = Account.getInstance(accountId);
        Account.setCurrentAccountId(accountId);
        await account?.setEntropy(entropy)
        const pwd = hashSha256(password)
        const ts = +(new Date());
        const {address, sign} = await account!.signMessage(ts.toString(), pwd);
        const session = Account.formatSession({address,sign,ts,accountId});
        account!.saveSession(session)
        await callApiWithPdu(new AuthNativeReq({
          accountId,entropy:mnemonic.toEntropy(),session
        }).pack())
        window.location.reload()
      }
    }else{
      await this.chatMsg.setText("mnemonic 不合法").reply()
    }
  }

  async switchAccount(messageId:number,data:string){
    const {chatId} = this;
    const accountAddress = data.replace(`${chatId}/setting/switchAccount/account/`,'')
    const keys = Account.getKeys();
    const sessions = Account.getSessions();
    const global = getGlobal();
    if(sessions && Object.keys(sessions).length > 0){
      for (let i = 0; i < Object.keys(sessions).length; i++) {
        const session = sessions[Object.keys(sessions)[i]]
        const res = Account.parseSession(session)
        if(res?.address === accountAddress){
          const accountId = res.accountId;
          const account = Account.getInstance(accountId);
          if(keys[accountId]){
            const entropy = keys[accountId]
            account?.setEntropy(entropy,true)
            const {password} = await getPasswordFromEvent(undefined,true)
            if(password){
              const resVerify = await account?.verifySession(session,password);
              if(resVerify){
                Account.setCurrentAccountId(accountId)
                return await this.enableSync(global,password,messageId)
              }else{
                return MsgDispatcher.showNotification("密码不正确!")
              }
            }
            break
          }
        }
      }
    }else{
      const {password} = await getPasswordFromEvent(undefined,true)
      if(password){
        return await this.enableSync(global,password,messageId)
      }
    }
  }

  async enableSync(global:GlobalState,password:string,messageId?:number){
    const {chatId} = this;
    const account = Account.getCurrentAccount();
    const pwd = hashSha256(password)
    const ts = +(new Date());
    const {address, sign} = await account!.signMessage(ts.toString(), pwd);
    const session = Account.formatSession({address,sign,ts,accountId:account?.getAccountId()!});
    account!.saveSession(session)
    const entropy = await account!.getEntropy()
    const accountId = account!.getAccountId();
    if(chatId){
      await this.chatMsg.update(messageId!,{
        inlineButtons:[]
      })
    }
    await callApiWithPdu(new AuthNativeReq({
      accountId,entropy,session
    }).pack())
    setTimeout(()=>window.location.reload(),200)
  }

  async answerCallbackButton(global:GlobalState,messageId:number,data:string){
    const {chatId} = this;
    if(data.startsWith(`${chatId}/setting/switchAccount/account/`)){
      return await this.switchAccount(messageId,data)
    }
    if(data.startsWith(`${chatId}/setting/back`)){
      new MsgCommand(chatId).back(global,messageId,data,"setting/back")
      return
    }
    if(data.startsWith(`${chatId}/setting/switchAccount/back/`)){
      const inlineButtons = JSON.parse(data.replace(`${chatId}/setting/switchAccount/back/`,""))
      return this.chatMsg.update(messageId,{
        content:{
          text:{
            text:"设置面板"
          }
        },
        inlineButtons
      })
    }

    switch (data){
      case `${chatId}/setting/cloud`:
        await this.chatMsg.update(messageId,{
          inlineButtons:[
            [
              {
                data:`${chatId}/setting/uploadFolder`,
                text:"上传所有机器人",
                type:"callback"
              },
              {
                data:`${chatId}/setting/downloadFolder`,
                text:"下载所有机器人",
                type:"callback"
              },
            ],
            MsgCommand.buildInlineBackButton(chatId,messageId,'setting/back',"< 返回")
          ],
        })
        break
      case `${chatId}/setting/clearHistory`:
        await new MsgCommand(chatId).clearHistory()
        break
      case `${chatId}/setting/reloadCommand`:
        await new MsgCommand(chatId).reloadCommands(DEFAULT_BOT_COMMANDS)
        break
      case `${chatId}/setting/uploadFolder`:
        const message1 = await this.chatMsg.setText("正在上传...").reply()
        await MsgCommandSetting.syncFolders(true)
        await this.chatMsg.updateText(message1.id,"上传成功")
        break
      case `${chatId}/setting/downloadFolder`:
        const message2 = await this.chatMsg.setText("正在下载...").reply()
        await MsgCommandSetting.syncFolders(false)
        await this.chatMsg.updateText(message2.id,"下载成功")
        break
      case `${chatId}/setting/syncMessage`:
        getActions().updateGlobal({
          showPickBotModal:true
        })
        break
      case `${chatId}/setting/uploadMessages`:
      case `${chatId}/setting/downloadMessages`:
        currentSyncBotContext = data;
        getActions().updateGlobal({
          showPickBotModal:true
        })
        break
      case `${chatId}/setting/switchAccount`:
        const address = Account.getCurrentAccount()?.getSessionAddress()
        await this.chatMsg.setText("当前账户:\n```\n"+address+"```").setInlineButtons([
          MsgCommand.buildInlineCallbackButton(chatId,"setting/showMnemonic","导出此账户",'callback'),
          MsgCommand.buildInlineButton(chatId,"",'unsupported'),
          MsgCommand.buildInlineCallbackButton(chatId,"setting/enableSync","密码登录",'callback'),
          MsgCommand.buildInlineButton(chatId,"二维码导入",'requestUploadImage'),
          MsgCommand.buildInlineCallbackButton(chatId,"setting/switchAccount/back/"+JSON.stringify(selectChatMessage(global,chatId,messageId)?.inlineButtons),"< 返回",'callback')
        ]).reply()
        break
      case `${chatId}/setting/showMnemonic`:
        getActions().updateGlobal({
          showMnemonicModal:true
        })
        break
      case `${chatId}/setting/cancel`:
        await this.chatMsg.update(messageId,{
          inlineButtons:[],
        })
        break
      case `${chatId}/setting/disableSync`:
        await this.disableSync(global,messageId)
        break
      case `${chatId}/setting/enableSync`:
        const {password} = await getPasswordFromEvent(undefined,true)
        if(password){
          await this.enableSync(global,password,messageId)
        }
        break
    }
  }

  static async syncFolders(isUpload:boolean){
    let global = getGlobal();
    const chats = global.chats.byId
    const chatIds = Object.keys(chats).filter(id=>id !== "1");
    const chatIdsDeleted:string[] = global.chatIdsDeleted;
    console.log("【local】",{chatIds,chatIdsDeleted})
    const userStoreData:UserStoreData_Type|undefined = isUpload ?{
      time:currentTs(),
      chatFolders:JSON.stringify(global.chatFolders),
      chatIds,
      chatIdsDeleted
    } :undefined

    const res = await callApiWithPdu(new SyncReq({
      userStoreData
    }).pack())
    const syncRes = SyncRes.parseMsg(res!.pdu)

    let users:UserStoreRow_Type[] = [];
    if(isUpload){
      for (let index = 0; index < chatIds.length; index++) {
        const userId = chatIds[index];
        const user = selectUser(global,userId);
        if(user?.photos && user.photos[0] === null){
          user.photos = []
        }
        users.push({
          time:currentTs(),
          userId,
          user
        })
      }

      await callApiWithPdu(new UploadUserReq({
        users,
        time:currentTs()
      }).pack())
    }

    if(syncRes.userStoreData){
      let {chatFolders,...res} = syncRes.userStoreData
      console.log("【remote userStoreData】",res,"chatFolders:",chatFolders ? JSON.parse(chatFolders):[])
      if(!chatFolders){
        // @ts-ignore
        chatFolders = global.chatFolders
      }else{
        chatFolders = JSON.parse(chatFolders)
      }
      res.chatIdsDeleted?.forEach(id=>{
        if(!chatIdsDeleted.includes(id)){
          chatIdsDeleted.push(id)
        }
      })
      if(res.chatIds){
        const DownloadUserReqRes = await callApiWithPdu(new DownloadUserReq({
          userIds:res.chatIds.filter(id=>id!== UserIdFirstBot),
        }).pack())
        if(DownloadUserReqRes){
          const downloadUserRes = DownloadUserRes.parseMsg(DownloadUserReqRes?.pdu!)
          console.log("【DownloadUserRes】",downloadUserRes.users)
          global = getGlobal();
          if(downloadUserRes.users){
            const addUsersObj = {}
            const addChatsObj = {}
            for (let index = 0; index < downloadUserRes.users.length; index++) {
              const {user} = downloadUserRes.users[index];
              if(!chatIdsDeleted.includes(user!.id) && user!.id !== UserIdFirstBot){
                if(chatIds.includes(user!.id)){
                  // @ts-ignore
                  global = updateUser(global,user!.id, user!)
                }else{
                  chatIds.push(user?.id!)
                  // @ts-ignore
                  addUsersObj[user!.id] = user!
                  // @ts-ignore
                  addChatsObj[user!.id] = ChatMsg.buildDefaultChat(user!)
                }
              }
            }
            if(Object.keys(addUsersObj).length > 0){
              global = addUsers(global,addUsersObj)
              global = addChats(global,addChatsObj)
            }
          }
          global = updateChatListIds(global, "active", chatIds);
          // @ts-ignore
          global = {...global,chatFolders}
          setGlobal({
            ...global,
            chatIdsDeleted:chatIdsDeleted || [],
          })
        }
      }else{
        getActions().updateGlobal({
          chatIdsDeleted:chatIdsDeleted || [],
          chatFolders
        })
      }
    }
  }

  async disableSync(global:GlobalState,messageId:number){
    const account = Account.getCurrentAccount();
    account?.delSession();
    await this.chatMsg.update(messageId,{
      inlineButtons:[]
    })
    await callApiWithPdu(new AuthNativeReq({
      accountId:account!.getAccountId(),
      entropy:await account!.getEntropy(),
      session:undefined
    }).pack())
    setTimeout(()=>window.location.reload(),500)
  }

  async onSelectSyncBot(){
    const data = currentSyncBotContext;
    const isUpload = !data?.endsWith("downloadMessages");
    currentSyncBotContext = undefined
    let global = getGlobal();
    if(isUpload){
      const messageById = selectChatMessages(global,this.chatId);
      const messages:MessageStoreRow_Type[] = [];
      if(messageById){
        for (let i = 0; i < Object.keys(messageById).length; i++) {
          const msgId = parseInt(Object.keys(messageById)[i])
          // @ts-ignore
          const message:PbMsg_Type = messageById[msgId]
          messages.push({
            time:currentTs(),
            message,
            messageId:msgId,
          })
        }
      }
      await this.uploadMsgList(messages)

    }else{
      const res = await callApiWithPdu(new DownloadMsgReq({
        chatId:this.chatId,
      }).pack())
      if(res){
        const {err,messages} = DownloadMsgRes.parseMsg(res?.pdu)
        console.log("messages",messages)
        if(messages){
          for (let i = 0; i < messages?.length; i++) {
            const {message,messageId} = messages[i]
            const localMsg = selectChatMessage(global,this.chatId,messageId)
            if(!localMsg){
              // @ts-ignore
              MsgDispatcher.newMessage(chatId,messageId,message)
            }else{
              // @ts-ignore
              MsgDispatcher.updateMessage(chatId,messageId,message)
            }
          }
        }
        getActions().showNotification({message:"更新成功"})
      }else{
        getActions().showNotification({message:"更新失败"})
      }
    }
  }

  async uploadMsgList(messages:MessageStoreRow_Type[]){

    if(messages.length > 0){
      const res = await callApiWithPdu(new UploadMsgReq({
        messages,
        chatId:this.chatId,
        time:currentTs(),
      }).pack())
      if(!res){
        getActions().showNotification({message:"更新失败"})
      }else{
        getActions().showNotification({message:"更新成功"})
      }
    }
  }
}
