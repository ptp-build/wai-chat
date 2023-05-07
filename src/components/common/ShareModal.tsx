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
import {selectChatMessage, selectUser} from "../../global/selectors";

export type OwnProps = {
  isOpen: boolean;
  messageId:number,
  chatId:string,
  aiAssistantMsgId?:number,
  aiUserMsgId?:number,
  onClose: () => void;
};

const ShareModel: FC<OwnProps> = ({
  isOpen,
  aiAssistantMsgId,
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

      const message = selectChatMessage(global,chatId,messageId);
      if(message?.chatId){
        const user = selectUser(getGlobal(),message?.chatId!)
        setText(`我正在使用 @WaiChatBot ${user?.firstName} ,\n${user?.fullInfo?.bio}\n#Wai\n${window.location.href}\n`)
      }

      if(aiAssistantMsgId && aiUserMsgId){
        url = await generateImageFromDiv(
          ['message'+aiUserMsgId,'message'+aiAssistantMsgId],
          20,
          "#99BA92",
          watermark
        );
        const message = selectChatMessage(global,chatId,aiUserMsgId);
      }else{
        url = await generateImageFromDiv(
          ['message'+messageId],
          20,
          "#99BA92",
          watermark
        );

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
      <div>
        {text}
      </div>
      <div className={"share-image-wrap"}>
        {
          imageUrl &&
          <a href={imageUrl} target="_blank" className={"share-image"} ><img src={imageUrl} alt=""/></a>
        }
      </div>
      <div className={"share-image-actions"}>
        <Button type="button" onClick={handleCopyClipboard} ripple={true} isLoading={!imageUrl} disabled={!imageUrl}>
          点击复制图片
        </Button>
        <Button
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&via=&media=${encodeURIComponent(imageUrl)}`}
          type="button"
          target={"_blank"}
          ripple={true} disabled={!readyToForward}>
          点击打开 Twitter 手动粘贴图片
        </Button>
      </div>
    </Modal>
  );
};

export default memo(ShareModel);
