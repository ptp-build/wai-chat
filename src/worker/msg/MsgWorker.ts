import {ApiAttachment, ApiBotInfo, ApiChat, ApiMessage, ApiUpdate, OnApiUpdate} from "../../api/types";
import {LOCAL_MESSAGE_MIN_ID, MEDIA_CACHE_NAME_WAI} from "../../config";
import {DownloadMsgRes, GenMsgIdReq, GenMsgIdRes, UploadMsgReq} from "../../lib/ptp/protobuf/PTPMsg";
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
import {parseCodeBlock, parseEntities} from "../share/utils/stringParse";
import MsgChatGptWorker from "./MsgChatGpWorker";
import * as cacheApi from "../../util/cacheApi";
import {Type} from "../../util/cacheApi";
import {DownloadRes} from "../../lib/ptp/protobuf/PTPFile";
import {uploadFileCache} from "../../lib/gramjs/client/uploadFile";

let messageIds:number[] = [];

export default class MsgWorker {
  private botInfo?: ApiBotInfo;
  private chat: ApiChat;
  private msgSend: ApiMessage;
  private media: GramJs.TypeInputMedia | undefined;
  private attachment?: ApiAttachment;
  private static onUpdate: (update: ApiUpdate) => void;
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
  },onUpdate:OnApiUpdate) {
    MsgWorker.onUpdate = onUpdate;
    this.botInfo = botInfo;
    this.chat = chat;
    this.media = media;
    this.msgSend = msgSend;
    this.attachment = attachment;
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
  static handleMessageTextCode(msgSend:Partial<ApiMessage>){
    if(msgSend.content?.text && msgSend.content.text.text){
      // @ts-ignore
      msgSend.content.text = parseCodeBlock(msgSend.content.text?.text)
    }
    return msgSend
  }
  static handleBotCmdText(msgSend:Partial<ApiMessage>,botInfo:ApiBotInfo){
    const commands:string[] = []
    if(botInfo && botInfo.commands){
      botInfo.commands.forEach(cmd=>commands.push(cmd.command))
    }
    if(msgSend.content && msgSend.content.text && msgSend.content.text.text){
      // @ts-ignore
      msgSend.content.text!.entities = [
        ...msgSend.content.text!.entities||[],
        ...parseEntities(msgSend.content.text!.text!,commands)
      ]
    }
    return msgSend;
  }
  static updateMessage(chatId:string,messageId:number,message:Partial<ApiMessage>){
    MsgWorker.onUpdate({
      '@type': "updateMessage",
      id: messageId,
      chatId,
      message,
    });
    return message
  }
  static newMessage(chatId:string,messageId:number,message:ApiMessage){
    MsgWorker.onUpdate({
      '@type': "newMessage",
      chatId,
      id:messageId,
      message,
      shouldForceReply:false
    });
    return message
  }
  async processOutGoing(){
    const {msgSend} = this;
    const msgId = await MsgWorker.genMessageId();
    let message = {
      ...msgSend,
      id:msgId,
      sendingState: undefined,
    };
    MsgWorker.onUpdate({
      '@type': "updateMessageSendSucceeded",
      chatId: msgSend.chatId,
      localId:msgSend.id,
      message,
    });
  }
  async processBotMsg(){
    const {botInfo,msgSend} =this;
    if(
      msgSend.content.text && msgSend.content.text.text &&
      botInfo?.aiBot && botInfo?.aiBot.enableAi && botInfo?.aiBot.chatGptConfig
    ){
      return await new MsgChatGptWorker(this.msgSend,botInfo).process()
    }
  }
  async process(){
    const {msgSend,chat,botInfo} = this;

    try {
      await this.handleMedia();
      if(botInfo){
        this.msgSend = MsgWorker.handleBotCmdText(this.msgSend,botInfo);
      }
      await this.processOutGoing();
      if(this.botInfo){
        await this.processBotMsg();
      }
    }catch (error:any){
      console.error(error)
      MsgWorker.onUpdate({
        '@type': 'updateMessageSendFailed',
        chatId: chat.id,
        localId: msgSend.id,
        error: error.message,
      });
    }
  }
}
