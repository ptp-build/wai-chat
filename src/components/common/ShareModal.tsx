import type {ChangeEvent} from 'react';

import type {FC} from '../../lib/teact/teact';
import React, {memo, useCallback, useEffect, useState,} from '../../lib/teact/teact';
import {getActions, getGlobal} from '../../global';

import useLang from '../../hooks/useLang';

import Modal from '../ui/Modal';
import Button from '../ui/Button';
import {generateImageFromDiv} from "../../worker/share/utils/canvas";
import {showBodyLoading} from "../../worker/share/utils/utils";
import {WaterMark} from "../../worker/setting";
import {fetchBlob} from "../../util/files";
import {copyBlobToClipboard} from "../../util/clipboard";
import {selectChatMessage} from "../../global/selectors";

export type OwnProps = {
  isOpen: boolean;
  messageId:number,
  chatId:string,
  aiAssitantMsgId?:number,
  aiUserMsgId?:number,
  onClose: () => void;
};

const ShareModel: FC<OwnProps> = ({
  isOpen,
  aiAssitantMsgId,
  aiUserMsgId,
  messageId,
  chatId,
  onClose,
}) => {
  const global = getGlobal();
  const [imageUrl, setImageUrl] = useState("");
  const [readyToForward, setReadyToForward] = useState(false);
  const [text, setText] = useState("");
  useEffect(()=>{
    const init = async ()=>{
      showBodyLoading(true);
      let url;
      const watermark = WaterMark
      if(aiAssitantMsgId && aiUserMsgId){
        url = await generateImageFromDiv(
          ['message'+aiUserMsgId,'message'+aiAssitantMsgId],
          20,
          "#99BA92",
          watermark
        );
        const message = selectChatMessage(global,chatId,aiUserMsgId);
        if(message){
          setText(message.content.text!.text)
        }
      }else{
        url = await generateImageFromDiv(
          ['message'+messageId],
          20,
          "#99BA92",
          watermark
        );
        const message = selectChatMessage(global,chatId,messageId);
        if(message && message.content.text){
          const {text} = message.content.text
          if(text.length  < 50){
            setText(text)
          }else{
            setText(text.substring(0,50))
          }
        }
      }

      setImageUrl(url)
      showBodyLoading(false);
    }
    if(isOpen){
      init()
    }
  },[isOpen])

  const handleCopyClipboard = useCallback(async () => {
    if(imageUrl){
      const blob = await fetchBlob(imageUrl)
      await copyBlobToClipboard(blob)
      getActions().showNotification({message:"复制成功"})
      setReadyToForward(true)
    }
  }, [imageUrl]);
  console.log({isOpen})

  const lang = useLang();
  return (
    <Modal
      noBackdropClose={true}
      hasCloseButton={true}
      isOpen={isOpen}
      onClose={()=>{
        setImageUrl("");
        onClose()
      }}
      title={"分享"}
    >
      <div className={"share-image-wrap"}>
        {
          imageUrl &&
          <a href={imageUrl} target="_blank" className={"share-image"} ><img src={imageUrl} alt=""/></a>
        }
      </div>
      <div className={"share-image-actions"}>
        <Button type="button" onClick={handleCopyClipboard} ripple={true} isLoading={!imageUrl} disabled={!imageUrl}>
          点击复制
        </Button>
        <Button
          href={`https://twitter.com/intent/tweet?text=${text}&url=${window.location.href}&hashtags=${encodeURIComponent("wai,ChatGpt")}&via=&media=${encodeURIComponent(imageUrl)}`}
          type="button"
          target={"_blank"}
          ripple={true} disabled={!readyToForward}>
          分享到 Twitter
        </Button>
      </div>
    </Modal>
  );
};

export default memo(ShareModel);
