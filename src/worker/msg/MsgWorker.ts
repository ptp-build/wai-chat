import {ApiAttachment, ApiBotInfo, ApiChat, ApiMessage, ApiUpdate, OnApiUpdate} from "../../api/types";
import {CLOUD_WS_URL, LOCAL_MESSAGE_MIN_ID, MEDIA_CACHE_NAME_WAI} from "../../config";
import {DownloadMsgRes, GenMsgIdReq, GenMsgIdRes, SendBotMsgRes, UploadMsgReq} from "../../lib/ptp/protobuf/PTPMsg";
import {getNextLocalMessageId} from "../../api/gramjs/apiBuilders/messages";
import {
  Pdu,
  popByteBuffer,
  readBytes,
  readInt16,
  readInt32,
  toUint8Array,
  wrapByteBuffer,
  writeBytes,
  writeInt16,
  writeInt32
} from "../../lib/ptp/protobuf/BaseMsg";
import {PbMsg, PbUser} from "../../lib/ptp/protobuf/PTPCommon";
import {account} from "../../api/gramjs/methods/client";
import {DownloadUserRes, UploadUserReq} from "../../lib/ptp/protobuf/PTPUser";
import {sleep} from "../../lib/gramjs/Helpers";
import {Api as GramJs} from "../../lib/gramjs";
import {blobToDataUri, fetchBlob} from "../../util/files";
import * as cacheApi from "../../util/cacheApi";
import {Type} from "../../util/cacheApi";
import {DownloadRes} from "../../lib/ptp/protobuf/PTPFile";
import {uploadFileCache} from "../../lib/gramjs/client/uploadFile";
import BotWebSocket, {BotWebSocketNotifyAction, BotWebSocketState} from "./bot/BotWebSocket";
import Account from "../share/Account";
import {ActionCommands} from "../../lib/ptp/protobuf/ActionCommands";
import ChatMsg from "./ChatMsg";

let messageIds:number[] = [];

export default class MsgWorker {
  private botInfo?: ApiBotInfo;
  private chat: ApiChat;
  private msgSend: ApiMessage;
  private media: GramJs.TypeInputMedia | undefined;
  private attachment?: ApiAttachment;
  private chatMsg: ChatMsg;
  constructor({
      chat,
      msgSend,
      attachment,
      media,
      botInfo,
    }:{
    chat:ApiChat;
    media: GramJs.TypeInputMedia | undefined;
    msgSend:ApiMessage;
    attachment?:ApiAttachment;
    botInfo?:ApiBotInfo;
  }) {
    this.botInfo = botInfo;
    this.chat = chat;
    this.media = media;
    this.msgSend = msgSend;
    this.attachment = attachment;
    this.chatMsg = new ChatMsg(chat.id)
  }

  static async createWsBot(accountId:number,botApi?:string){
    if(botApi && botApi.startsWith("ws")){
      const botWs = BotWebSocket.getInstance(accountId)
      if(!botWs.isLogged()){
        botWs.setMsgHandler(async (msgConnId, notifies)=>{
          for (let i = 0; i < notifies.length; i++) {
            const {action,payload} = notifies[i]
            switch (action){
              case BotWebSocketNotifyAction.onConnectionStateChanged:
                switch (payload.BotWebSocketState){
                  case BotWebSocketState.connected:
                    break;
                  case BotWebSocketState.closed:
                    break;
                }
                break
              case BotWebSocketNotifyAction.onData:
                console.log("[onData]",{accountId,payload})
                switch (payload.getCommandId()) {
                  case ActionCommands.CID_SendBotMsgRes:
                    const {reply,msgId,chatId,streamEnd} = SendBotMsgRes.parseMsg(payload)
                    console.log("[SendBotMsgRes]",reply)
                    if(reply){
                      if(msgId){
                        await new ChatMsg(chatId!).update(msgId,{
                          content:{
                            text:{
                              text:reply
                            }
                          }
                        })
                      }else{
                        const msgId1 = await MsgWorker.genMessageId();
                        await new ChatMsg(chatId!).setText(reply).reply();
                      }
                    }
                    break
                }
                break
            }
          }
        })
        botWs.setWsUrl(botApi ? botApi : CLOUD_WS_URL)
        botWs.setSession(Account.getCurrentAccount()?.getSession()!)
        botWs.connect();
        await botWs.waitForMsgServerState(BotWebSocketState.logged)
      }
    }
  }
  static async beforeUploadUserReq(pdu:Pdu){
    const {users,...res} = UploadUserReq.parseMsg(pdu)
    if(users){
      for (let i = 0; i < users?.length; i++) {
        if (users) {
          if(
            (users.length === 1 && users[0].user!.photos && users[0].user!.photos.length > 0 )
          ){
            const photo = users[0].user!.photos[0];
            let id;
            if(photo && photo.id){
              id = photo.id;
            }
            if(id){
              let arrayBuffer = await cacheApi.fetch(MEDIA_CACHE_NAME_WAI, id, Type.ArrayBuffer);
              if(arrayBuffer){
                // @ts-ignore
                const res = DownloadRes.parseMsg(new Pdu(Buffer.from(arrayBuffer)));
                if(!res || !res.file){
                  break
                }
                await uploadFileCache(res.file!)
              }
            }
          }
          const {time,user} = users[i]
          let buf = Buffer.from(new PbUser(user!).pack().getPbData())
          const password = "Wai" + time!.toString();
          // console.log("accountId",account.getAccountId())
          // console.log("entropy",await account.getEntropy())
          const cipher = await account.encryptData(buf,password)
          const bb = popByteBuffer();
          writeInt32(bb, cipher?.length + 4 + 4 + 4 + 2);
          writeInt16(bb, 1);
          writeInt32(bb, time!);
          writeInt32(bb, 0);
          writeBytes(bb, cipher);
          users[i].buf = Buffer.from(toUint8Array(bb));
          users[i].user = undefined
          // console.log("userId",user?.id)
          // console.log("buf",buf)
          // console.log("cipher",cipher)
          // console.log("msg buf",users[i].buf)
        }
      }
    }

    return new UploadUserReq({users,...res}).pack()
  }
  static async afterDownloadUserReq(pdu:Pdu){
    const {users,...res} = DownloadUserRes.parseMsg(pdu)
    if(users){
      for (let i = 0; i < users?.length; i++) {
        if (users) {
          const {buf} = users[i]
          const bbDecode = wrapByteBuffer(Buffer.from(buf!))
          const len = readInt32(bbDecode);
          const encrypt = readInt16(bbDecode) === 1;
          const time = readInt32(bbDecode);
          const reverse = readInt32(bbDecode);
          let cipher = readBytes(bbDecode,len - 14);
          const password = "Wai"+time.toString();
          // console.log("encode",Buffer.from(buf!).toString("hex"))
          // console.log("cipher",Buffer.from(cipher).toString("hex"))
          const buf2 = await account.decryptData(Buffer.from(cipher),password)
          // console.log("userId",user?.id)
          // console.log("buf",buf)
          // console.log("cipher",cipher)
          // console.log("msg buf",user)
          users[i].user = PbUser.parseMsg(new Pdu(Buffer.from(buf2)));
          users[i].buf = undefined
        }
      }
    }

    return Buffer.from(new DownloadUserRes({...res,users}).pack().getPbData())
  }
  static async afterDownloadMsgReq(pdu:Pdu){
    const {messages,...res} = DownloadMsgRes.parseMsg(pdu)
    if(messages){
      for (let i = 0; i < messages?.length; i++) {
        const {buf} = messages[i]
        const bbDecode = wrapByteBuffer(Buffer.from(buf!))
        const len = readInt32(bbDecode);
        const encrypt = readInt16(bbDecode) === 1;
        const time = readInt32(bbDecode);
        const reverse = readInt32(bbDecode);
        let cipher = readBytes(bbDecode,len - 14);
        const password = "Wai"+time.toString();
        // console.log("encode",Buffer.from(buf!).toString("hex"))
        // console.log("cipher",Buffer.from(cipher).toString("hex"))
        const buf2 = await account.decryptData(Buffer.from(cipher),password)
        messages[i].message = PbMsg.parseMsg(new Pdu(Buffer.from(buf2)))
        messages[i].buf = undefined
        // console.log("userId",user?.id)
        // console.log("buf",buf)
        // console.log("cipher",cipher)
        // console.log("msg buf",users[i].buf)
      }
    }
    return Buffer.from(new DownloadMsgRes({...res,messages}).pack().getPbData())
  }
  static async beforeUploadMsgReq(pdu:Pdu){
    const {messages,...res} = UploadMsgReq.parseMsg(pdu)

    if(messages){
      if(messages.length === 1){
        const {photo,voice,audio,document} = messages[0].message!.content;
        let id;
        if(photo && photo.id){
          id = photo.id;
        }else if(voice && voice.id){
          id = voice.id;
        }else if(audio && audio.id){
          id = audio.id;
        }else if(document && document.id){
          id = document.id;
        }
        if(id){
          let arrayBuffer = await cacheApi.fetch(MEDIA_CACHE_NAME_WAI, id, Type.ArrayBuffer);

          if(arrayBuffer){
            // @ts-ignore
            const {file} = DownloadRes.parseMsg(new Pdu(Buffer.from(arrayBuffer)));
            await uploadFileCache(file!)
          }
        }
      }
      for (let i = 0; i < messages?.length; i++) {
        const {time,message} = messages[i]
        let buf = Buffer.from(new PbMsg(message!).pack().getPbData())
        const password = "Wai"+time!.toString();
        const cipher = await account.encryptData(buf,password)
        const bb = popByteBuffer();
        writeInt32(bb, cipher?.length + 4 + 4 + 4 + 2);
        writeInt16(bb, 1);
        writeInt32(bb, time!);
        writeInt32(bb, 0);
        writeBytes(bb, cipher);
        messages[i].buf = Buffer.from(toUint8Array(bb));
        messages[i].message = undefined
        // console.log("buf",buf)
        // console.log("cipher",cipher)
        // console.log("msg buf",messages[i].buf)
      }
    }
    return new UploadMsgReq({messages,...res}).pack()
  }
  static async genMessageId(isLocal?:boolean):Promise<number>{
    let msgId = isLocal ? getNextLocalMessageId() : parseInt(getNextLocalMessageId().toString()) % LOCAL_MESSAGE_MIN_ID;
    if(messageIds.length > 10){
      messageIds = messageIds.slice(messageIds.length - 10)
    }
    if(messageIds.includes(msgId)){
      await sleep(100);
      return MsgWorker.genMessageId(isLocal);
    }else{
      messageIds.push(msgId);
      return msgId
    }
  }

  static async genMsgId(pdu:Pdu):Promise<Uint8Array>{
    const {isLocal} = GenMsgIdReq.parseMsg(pdu)
    return new GenMsgIdRes({messageId:await MsgWorker.genMessageId(isLocal)}).pack().getPbData()
  }

  static getMediaFileId(media: GramJs.TypeInputMedia | undefined){
    let fileId;
    //@ts-ignore
    if (media && media!.file && media.file.id) {
      //@ts-ignore
      fileId = media!.file.id.toString()
    }
    return fileId
  }

  async handleMedia(){
    const {msgSend,attachment} = this;
    if(attachment){
      let fileId = MsgWorker.getMediaFileId(this.media);

      if (msgSend.content.photo || msgSend.content.document) {
        const getPhotoInfo = async (attachment: ApiAttachment) => {
          const dataUri = await blobToDataUri(await fetchBlob(attachment.thumbBlobUrl!));
          const size = {
            "width": attachment.quick!.width,
            "height": attachment.quick!.height,
          }
          return {
            dataUri, size
          }
        }

        if (msgSend.content.document) {
          msgSend.content.document.id = fileId

          if (msgSend.content.document.mimeType.split("/")[0] === "image") {
            const {size, dataUri} = await getPhotoInfo(attachment);
            msgSend.content.document.mediaType = "photo";
            msgSend.content.document.previewBlobUrl = undefined;
            msgSend.content.document.thumbnail = {
              ...size,
              dataUri
            }
            msgSend.content.document.mediaSize = size;
          }
        }

        if(msgSend.content.photo){
          const {size,dataUri} = await getPhotoInfo(attachment);
          msgSend.content.photo = {
            isSpoiler:msgSend.content.photo.isSpoiler,
            id:fileId,
            "thumbnail": {
              ...size,
              dataUri
            },
            "sizes": [
              {
                ...size,
                "type": "y"
              }
            ],
          }
        }
      }

      if(msgSend.content.voice){
        msgSend.content.voice.id = fileId
      }
      if(msgSend.content.audio){
        msgSend.content.audio.id = fileId
      }
      this.msgSend = msgSend;
    }
  }

  async processOutGoing(){
    const {msgSend} = this;
    const msgId = await MsgWorker.genMessageId();
    let message = {
      ...msgSend,
      id:msgId,
      isOutGoing:false,
      sendingState: undefined,
    };

    ChatMsg.apiUpdate({
      '@type': "updateMessageSendSucceeded",
      chatId: msgSend.chatId,
      localId:msgSend.id,
      message,
    })
    this.msgSend = message
  }

  async process(){
    const {msgSend,chat} = this;

    try {
      await this.handleMedia();
      await this.processOutGoing();
    }catch (error:any){
      console.error(error)
      ChatMsg.apiUpdate({
        '@type': 'updateMessageSendFailed',
        chatId: chat.id,
        localId: msgSend.id,
        error: error.message,
      })
    }
  }
}
