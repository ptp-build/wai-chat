import MsgDispatcher from "./MsgDispatcher";
import {selectChatMessage} from "../../global/selectors";
import {getActions, getGlobal, setGlobal} from "../../global";
import {ApiBotCommand, ApiKeyboardButtons, ApiMessage} from "../../api/types";
import {callApiWithPdu} from "./utils";
import {PbMsg_Type, QrCodeType} from "../../lib/ptp/protobuf/PTPCommon/types";
import {UpdateCmdReq, UpdateCmdRes, UploadMsgReq, UploadMsgRes} from "../../lib/ptp/protobuf/PTPMsg";
import Mnemonic, {MnemonicLangEnum} from "../../lib/ptp/wallet/Mnemonic";
import Account from "../share/Account";
import {GlobalState} from "../../global/types";
import {getPasswordFromEvent} from "../share/utils/password";
import {hashSha256} from "../share/utils/helpers";
import MsgCommand from "./MsgCommand";
import {Decoder} from "@nuintun/qrcode";
import {PbMsg, PbQrCode} from "../../lib/ptp/protobuf/PTPCommon";
import {Pdu} from "../../lib/ptp/protobuf/BaseMsg";
import {aesDecrypt} from "../../util/passcode";
import {CHATGPT_PROXY_API, CLOUD_MESSAGE_API, DEBUG} from "../../config";
import {DEFAULT_BOT_COMMANDS, DEFAULT_LANG_MNEMONIC, DEFAULT_START_TIPS, STOP_HANDLE_MESSAGE} from "../setting";
import ChatMsg from "./ChatMsg";
import {showModalFromEvent} from "../share/utils/modal";

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
    if(DEBUG){
      console.log("> chatFolders",JSON.stringify(getGlobal().chatFolders,null,2))
      console.log("> users",getGlobal().users)
      console.log("> chats",getGlobal().chats)
      console.log("> userStoreData",getGlobal().userStoreData)
      console.log("> topCats",getGlobal().topCats)
    }
    let tips = localStorage.getItem("DEFAULT_START_TIPS") || DEFAULT_START_TIPS
    const res = await callApiWithPdu(new UpdateCmdReq({
      botApi:MsgCommandSetting.getBotApi(),
      chatId,
    }).pack())
    if(res){
      const {commands,startTips} = UpdateCmdRes.parseMsg(res.pdu)
      await new MsgCommand(chatId).reloadCommands(commands as ApiBotCommand[])
      tips = startTips!
    }

    return this.chatMsg.setText(tips).reply()
  }
  static getBotApi(){
    return DEBUG ? 'http://localhost:2235/api/wai' : `${CHATGPT_PROXY_API}/wai`
  }

  async setting(outGoingMsgId:number) {
    const {chatId} = this;
    //@ts-ignore
    // await new MsgCommand(chatId).reloadCommands(DEFAULT_BOT_COMMANDS)
    // return  this.chatMsg.setText("设置面板")
    //   .setInlineButtons(this.getInlineButtons(outGoingMsgId))
    //   .reply()

    const address = Account.getCurrentAccount()?.getSessionAddress()
    const text = "设置";
    // const text = "当前账户:\n```\n"+address+"```";
    await this.chatMsg.setText(text).setInlineButtons([
      // MsgCommand.buildInlineButton(chatId,"",'unsupported'),
      [
        ...MsgCommand.buildInlineCallbackButton(chatId,"setting/doSwitchAccount",`切换账户 ( ${address?.substring(0,4)}***${address?.substring(address?.length - 4)} )`,'callback'),
      ],
      MsgCommand.buildInlineCallbackButton(chatId,"setting/clearHistory","清除历史记录",'callback'),
      MsgCommand.buildInlineCallbackButton(chatId,outGoingMsgId + "/setting/cancel","取消",'callback'),
      // MsgCommand.buildInlineCallbackButton(chatId,"setting/switchAccount/back/"+JSON.stringify(selectChatMessage(global,chatId,messageId)?.inlineButtons),"< 返回",'callback')
    ]).reply()
    return STOP_HANDLE_MESSAGE
  }

  getInlineButtons(outGoingMsgId:number):ApiKeyboardButtons{
    const {chatId} = this;
    const res:ApiKeyboardButtons = []
    res.push([
      {
        text:"切换账户",
        data:`${chatId}/setting/switchAccount`,
        type:"callback"
      },
    ])

    res.push([
      {
        text:"清除历史记录",
        data:`${chatId}/setting/clearHistory`,
        type:"callback"
      },
    ])
    // res.push([
    //   {
    //     text:"生成签名",
    //     data:`${chatId}/setting/signGen`,
    //     type:"callback"
    //   },
    // ])
    res.push([
      {
        data:`${chatId}/${outGoingMsgId}/setting/cancel`,
        text:"取消",
        type:"callback"
      },
    ])
    return res;
  }

  async requestUploadImage(global:GlobalState,messageId:number,files:FileList | null){
    if(files && files.length > 0){
      const file = files[0]
      const qrcode = new Decoder();
      const blob = new Blob([file], { type: file.type });
      const blobUrl = URL.createObjectURL(blob);
      try {
        const result = await qrcode.scan(blobUrl)
        if(result && result.data.startsWith('wai://')){
          await this.handleMnemonic(result.data)
        }
      }catch (e){
      }finally {
        getActions().showNotification({message:"解析二维码失败"})
      }
    }
  }
  async handleMnemonic(mnemonic:string){
    const qrcodeData = mnemonic.replace('wai://','')
    const qrcodeDataBuf = Buffer.from(qrcodeData,'hex')
    const decodeRes = PbQrCode.parseMsg(new Pdu(qrcodeDataBuf))
    if(decodeRes){
      const {type,data} = decodeRes;
      if(type !== QrCodeType.QrCodeType_MNEMONIC){
        throw new Error("解析二维码失败")
      }
      const {password} = await getPasswordFromEvent(undefined,true);
      const res = await aesDecrypt(data,Buffer.from(hashSha256(password!),"hex"))
      if(res){
        await this.changeMnemonic(res,password);
        return;
      }
    }
  }

  async changeMnemonic(words:string,password?:string){
    const mnemonic = new Mnemonic(words)
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
        setTimeout(()=>window.location.reload(),200)
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
                return await this.doSwitchAccount(global,password,messageId)
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
        return await this.doSwitchAccount(global,password,messageId)
      }
    }
  }

  async doSwitchAccount(global:GlobalState,password:string,messageId?:number){
    const {chatId} = this;
    const account = Account.getCurrentAccount();
    const pwd = hashSha256(password)
    const ts = +(new Date());
    const {address, sign} = await account!.signMessage(ts.toString(), pwd);
    const session = Account.formatSession({address,sign,ts,accountId:account?.getAccountId()!});
    account!.saveSession(session)
    await account!.getEntropy()
    account!.getAccountId();
    if(chatId){
      await this.chatMsg.update(messageId!,{
        inlineButtons:[]
      })
    }
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
      case `${chatId}/setting/importMnemonic`:
        const {value} = await showModalFromEvent({
          initVal:"",
          title:"助记词加密代码",
          type:"multipleInput",
          placeholder:"请输入以 wai:// 开头的助记词加密代码"
        })
        if(value && value.startsWith("wai://")){
          await this.handleMnemonic(value)
        }
        break
      case `${chatId}/setting/clearHistory`:
        await new MsgCommand(chatId).clearHistory()
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
          MsgCommand.buildInlineCallbackButton(chatId,"setting/doSwitchAccount","密码登录",'callback'),
          MsgCommand.buildInlineButton(chatId,"二维码导入",'requestUploadImage'),
          MsgCommand.buildInlineCallbackButton(chatId,"setting/importMnemonic","导入",'callback'),
          MsgCommand.buildInlineCallbackButton(chatId,"setting/switchAccount/back/"+JSON.stringify(selectChatMessage(global,chatId,messageId)?.inlineButtons),"< 返回",'callback')
        ]).reply()
        break
      case `${chatId}/setting/showMnemonic`:
        getActions().updateGlobal({
          showMnemonicModal:true
        })
        break
      case `${chatId}/setting/doSwitchAccount`:
        const entropy = await Account.getCurrentAccount()?.getEntropy();
        const mnemonic1 = Mnemonic.fromEntropy(entropy!,DEFAULT_LANG_MNEMONIC as MnemonicLangEnum).getWords()
        const {password,mnemonic} = await getPasswordFromEvent(
          undefined,
          true,"mnemonicPassword",false,{
            title:"切换账户",
            mnemonic:mnemonic1
          })
        if(password){
          if(mnemonic === mnemonic1){
            await this.doSwitchAccount(global,password,messageId)
          }else{
            await this.changeMnemonic(mnemonic!,password);
          }
        }
        break
    }
  }

  static async uploadMsgList(chatId:string,messagesList:ApiMessage[]){
    let global = getGlobal();
    const messages = messagesList.map(message=>Buffer.from(new PbMsg(message as PbMsg_Type).pack().getPbData()))
    const res = await callApiWithPdu(new UploadMsgReq({
      messages,
      chatId:chatId,
    }).pack())
    if(res && res.pdu){
      const {userMessageStoreData} = UploadMsgRes.parseMsg(res.pdu)
      global = getGlobal();
      setGlobal({
        ...global,
        userMessageStoreData:{
          ...global.userMessageStoreData,
          [chatId]:userMessageStoreData
        }
      })
      getActions().showNotification({message:"保存成功"})
    }else{
      getActions().showNotification({message:"保存失败"})
    }
  }
}
