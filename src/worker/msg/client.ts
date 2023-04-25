import {ClientInfo_Type} from "../../lib/ptp/protobuf/PTPCommon/types";
import LocalDatabase from "../share/db/LocalDatabase";
import localDb from "../../api/gramjs/localDb";
import Account from "../share/Account";
import BotWebSocket from "./bot/BotWebSocket";
import {CHATGPT_PROXY_API, MSG_SERVER} from "../../config";
import MsgWorker from "./MsgWorker";
import {Pdu} from "../../lib/ptp/protobuf/BaseMsg";
import {AuthNativeReq} from "../../lib/ptp/protobuf/PTPAuth";
import {StopChatStreamReq} from "../../lib/ptp/protobuf/PTPOther";
import {ControllerPool, requestChatStream} from "../../lib/ptp/functions/requests";
import {ApiKeyboardButtons} from "../../api/types";
import ChatMsg from "./ChatMsg";
import {SendBotMsgReq, SendBotMsgRes, UpdateCmdReq, UpdateCmdRes} from "../../lib/ptp/protobuf/PTPMsg";

export const handleAuthNative = async (accountId:number,entropy:string,session?:string,clientInfo?:ClientInfo_Type)=>{
  const kv = new LocalDatabase();
  kv.init(localDb);
  Account.setClientKv(kv)
  const account = Account.getInstance(accountId);
  account.setClientInfo(clientInfo)
  await account.setEntropy(entropy)
  Account.setCurrentAccountId(accountId)
  if(session){
    account.saveSession(session)

    const botWs = BotWebSocket.getInstance(accountId)
    if(!botWs.isLogged() && MSG_SERVER){
      MsgWorker.createWsBot(accountId,MSG_SERVER)
    }
  }else{
    account.delSession()
  }
}

export const handleAuthNativeReq = async (pdu:Pdu)=>{
  const {accountId,entropy,session} = AuthNativeReq.parseMsg(pdu)
  await handleAuthNative(accountId,entropy,session);
}

export const handleStopChatStreamReq = async (pdu:Pdu)=>{
  const {msgId,chatId} = StopChatStreamReq.parseMsg(pdu)
  ControllerPool.stop(chatId,msgId)
}

async function handleChatGpt(url:string,chatGpt:string,chatId?:string,msgId?:number){
  requestChatStream(
    url,
    {
      body:{
        ...JSON.parse(chatGpt)
        ,msgId,
        chatId,
        stream:true
      },
      onMessage:(content, done) =>{
        console.log(content)
        let inlineButtons:ApiKeyboardButtons = []
        if(content.startsWith("sign://401/")){
          inlineButtons = [
            [
              {
                text:"签名",
                data:"sign://401",
                type:"callback",
              }
            ]
          ]
          content = content.replace("sign://401/","")
          new ChatMsg(chatId!).update(msgId!,{
            content:{
              text:{
                text:content
              }
            },
            inlineButtons
          })
          return
        }
        new ChatMsg(chatId!).update(msgId!,{
          content:{
            text:{
              text:content
            }
          },
        })
        if(done){
          ControllerPool.remove(parseInt(chatId!), msgId!);
        }
      },
      onAbort:(error) =>{
        new ChatMsg(chatId!).update(msgId!,{
          content:{
            text:{
              text:"user abort"
            }
          },
        })
        ChatMsg.apiUpdate({
          "@type":"updateGlobalUpdate",
          data:{
            action:"updateChatGptHistory",
            payload:{
              chatId,
              msgIdAssistant:undefined,
            }
          }
        })
        ControllerPool.remove(parseInt(chatId!), msgId!);
      },
      onError:(error) =>{
        new ChatMsg(chatId!).update(msgId!,{
          content:{
            text:{
              text:error.message
            }
          },
        })

        ChatMsg.apiUpdate({
          "@type":"updateGlobalUpdate",
          data:{
            action:"updateChatGptHistory",
            payload:{
              chatId,
              msgIdAssistant:undefined,
            }
          }
        })
        ControllerPool.remove(parseInt(chatId!), msgId!);
      },
      onController:(controller) =>{
        ControllerPool.addController(
          parseInt(chatId!),
          msgId!,
          controller,
        );
      },
    }).catch(console.error);
}
export const handleSendBotMsgReq = async (pdu:Pdu)=>{
  const account = Account.getCurrentAccount()!
  let {botApi,chatId,msgId,chatGpt,text} = SendBotMsgReq.parseMsg(pdu)
  try {
    if(botApi && botApi.startsWith("http")){
      if(!botApi){
        botApi = CHATGPT_PROXY_API
      }
      if(chatGpt){
        let url =  botApi+"/v1/chat/completions";
        await handleChatGpt(url,chatGpt,chatId,msgId)
        return new SendBotMsgRes({
          reply:"..."
        }).pack().getPbData()
      }else{
        let url = botApi+"/message";
        try {
          const res = await fetch(url, {
            method: "POST",
            headers:{
              "Content-Type": "application/json; charset=utf-8",
              Authorization: `Bearer ${account.getSession()}`,
            },
            body:JSON.stringify({
              chatId,
              msgId,
              text
            })
          });
          if(!res || res.status !== 200){
            return;
          }
          return new SendBotMsgRes({
            reply:await res.text()
          }).pack().getPbData()
        }catch (e:any){
          return new SendBotMsgRes({
            reply:"Error invoke api," + e.message
          }).pack().getPbData()
        }
      }
    }else{
      const connId =botApi ? parseInt(chatId!) : Account.getCurrentAccountId()
      if(!botApi){
        botApi = CHATGPT_PROXY_API
      }
      const botWs = BotWebSocket.getInstance(connId)
      if(!botWs.isLogged()){
        await MsgWorker.createWsBot(connId,botApi)
      }
      const res = await botWs.sendPduWithCallback(new SendBotMsgReq({
        text,
        chatId,
        msgId,
        chatGpt
      }).pack())
      return res.getPbData()
    }
  }catch (e){
    console.error(e)
    return
  }
}

export const handleUpdateCmdReq = async (pdu:Pdu)=>{
  const account = Account.getCurrentAccount()!
  const {botApi,chatId} = UpdateCmdReq.parseMsg(pdu)
  if(botApi){
    try {
      if(botApi.startsWith("http")){
        const res = await fetch(botApi+"/commands", {
          method: "POST",
          headers:{
            Authorization: `Bearer ${account.getSession()}`,
          }
        });
        if(!res || res.status !== 200){
          return;
        }
        // @ts-ignore
        const {commands} = await res.json();
        return new UpdateCmdRes({
          commands
        }).pack().getPbData()
      }else{
        const botWs = BotWebSocket.getInstance(parseInt(chatId!))
        if(!botWs.isLogged()){
          await MsgWorker.createWsBot(parseInt(chatId!),botApi)
        }
        const res = await botWs.sendPduWithCallback(new UpdateCmdReq({
          chatId
        }).pack())
        const {commands} = UpdateCmdRes.parseMsg(res)
        return new UpdateCmdRes({
          commands
        }).pack().getPbData()
      }
    }catch (e){
      console.error(e)
      return
    }
  }
}
