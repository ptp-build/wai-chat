import {ApiMessageEntityTypes} from "../../../api/types";

export function parseCodeBlock(text:string) {
  const reg = /```(.*?)\n([\s\S]*?)```/g;
  if(text.indexOf("```") >= 0 && text.split("```").length % 2 === 0){
    text =  text+"```";
  }
  let result = text;
  let match;
  let codeBlock = [];
  let i = 0;
  let j = 0;
  while (match = reg.exec(text)) {
    codeBlock.push({
      type:ApiMessageEntityTypes.Pre,
      language: match[1],
      offset: match.index - 6 * i - j,
      length: match[2].length
    });
    j += match[1].length+1
    result = result.replace(match[0],  match[2]);
    ++i;
  }
  return {
    text:result.endsWith("```") ? result.substring(0,result.indexOf("```")): result,
    entities:codeBlock
  };
}

function parseMentionName(text:string) {
  const regex = /@\w+/g;
  let match;
  let result = [];
  while ((match = regex.exec(text)) !== null) {
    result.push({
      type:ApiMessageEntityTypes.MentionName,
      offset: match.index,
      length: match[0].length
    });
  }
  return result
}

function parseCmd(text:string, commands:string[]) {
  if(commands.length === 0) return [];
  const regex = new RegExp(`\\b(${commands.join('|')})\\b`, 'g');
  const matches = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      type:ApiMessageEntityTypes.BotCommand,
      offset: match.index-1,
      length: match[0].length + 1
    });
  }
  return matches
}

export function parseEntities(text:string,commands:string[]){
  return [
    ...parseCmd(text,commands),
    ...parseMentionName(text),
  ]
}
