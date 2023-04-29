import {ApiBotInfo, ApiMessage} from "../../api/types";
import {parseCodeBlock, parseEntities} from "../share/utils/stringParse";

export function handleMessageTextCode(msgSend:Partial<ApiMessage> | ApiMessage){
  if(msgSend.content?.text && msgSend.content.text.text){
    const {entities} = msgSend.content.text
    // @ts-ignore
    msgSend.content.text = {
      ...parseCodeBlock(msgSend.content.text?.text,entities)
    }
  }
  return msgSend
}

export function handleBotCmdText(msgSend:Partial<ApiMessage> | ApiMessage,botInfo:ApiBotInfo){
  const commands:string[] = []
  if(botInfo && botInfo.commands){
    botInfo.commands.forEach(cmd=>commands.push(cmd.command))
  }
  if(msgSend.content && msgSend.content.text && msgSend.content.text.text){
    if(msgSend.content.text!.entities && msgSend.content.text!.entities.find(e=>{
      // @ts-ignore
      return e.cipher
    })){
    }else{
      // @ts-ignore
      msgSend.content.text!.entities = [
        ...msgSend.content.text!.entities||[],
        ...parseEntities(msgSend.content.text!.text!,commands)
      ]
    }
  }
  return msgSend;
}
