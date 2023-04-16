import React, {
  useCallback, useRef, useState,
} from '../../../lib/teact/teact';

import type { FC } from '../../../lib/teact/teact';
import type { ApiMessage } from '../../../api/types';
import type { ISettings } from '../../../types';
import type { IMediaDimensions } from './helpers/calculateAlbumLayout';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import { CUSTOM_APPENDIX_ATTRIBUTE, MESSAGE_CONTENT_SELECTOR } from '../../../config';
import {
  getMessagePhoto,
  getMessageWebPagePhoto,
  getMessageMediaHash,
  getMediaTransferState,
  isOwnMessage,
  getMessageMediaFormat,
  getMessageMediaThumbDataUri,
} from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import getCustomAppendixBg from './helpers/getCustomAppendixBg';
import { calculateMediaDimensions } from './helpers/mediaDimensions';

import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMediaWithLoadProgress from '../../../hooks/useMediaWithLoadProgress';
import useShowTransition from '../../../hooks/useShowTransition';
import useBlurredMediaThumbRef from './hooks/useBlurredMediaThumbRef';
import usePrevious from '../../../hooks/usePrevious';
import useMediaTransition from '../../../hooks/useMediaTransition';
import useLayoutEffectWithPrevDeps from '../../../hooks/useLayoutEffectWithPrevDeps';
import useFlag from '../../../hooks/useFlag';
import useAppLayout from '../../../hooks/useAppLayout';

import ProgressSpinner from '../../ui/ProgressSpinner';
import MediaSpoiler from '../../common/MediaSpoiler';
import {getPasswordFromEvent} from "../../../worker/share/utils/password";
import {blobToBuffer, blobToDataUri, fetchBlob} from "../../../util/files";
import {
  readBytes,
  readInt16,
  wrapByteBuffer,
} from "../../../lib/ptp/protobuf/BaseMsg";
import Account from "../../../worker/share/Account";
import {getGlobal} from "../../../global";
import {hashSha256} from "../../../worker/share/utils/helpers";
import {UserIdFirstBot} from "../../../worker/setting";

export type OwnProps = {
  id?: string;
  message: ApiMessage;
  observeIntersection?: ObserveFn;
  noAvatars?: boolean;
  canAutoLoad?: boolean;
  isInSelectMode?: boolean;
  isSelected?: boolean;
  uploadProgress?: number;
  size?: 'inline' | 'pictogram';
  shouldAffectAppendix?: boolean;
  dimensions?: IMediaDimensions & { isSmall?: boolean };
  asForwarded?: boolean;
  nonInteractive?: boolean;
  isDownloading: boolean;
  isProtected?: boolean;
  theme: ISettings['theme'];
  onClick?: (id: number) => void;
  onCancelUpload?: (message: ApiMessage) => void;
};

export const photosMap:Record<string, string> = {}

const Photo: FC<OwnProps> = ({
  id,
  message,
  observeIntersection,
  noAvatars,
  canAutoLoad,
  isInSelectMode,
  isSelected,
  uploadProgress,
  size = 'inline',
  dimensions,
  asForwarded,
  nonInteractive,
  shouldAffectAppendix,
  isDownloading,
  isProtected,
  theme,
  onClick,
  onCancelUpload,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const [decryptUrl,setDecryptUrl] = useState("");

  const photo = (getMessagePhoto(message) || getMessageWebPagePhoto(message))!;
  const localBlobUrl = photo.blobUrl;

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const { isMobile } = useAppLayout();
  const [isLoadAllowed, setIsLoadAllowed] = useState(canAutoLoad);
  const shouldLoad = isLoadAllowed && isIntersecting;
  const {
    mediaData, loadProgress,
  } = useMediaWithLoadProgress(getMessageMediaHash(message, size), !shouldLoad);
  const fullMediaData = localBlobUrl || mediaData;

  const [withThumb] = useState(!fullMediaData);
  const noThumb = Boolean(fullMediaData);
  const thumbRef = useBlurredMediaThumbRef(message, noThumb);
  const thumbClassNames = useMediaTransition(!noThumb);
  const thumbDataUri = getMessageMediaThumbDataUri(message);

  const [isSpoilerShown, , hideSpoiler] = useFlag(photo.isSpoiler);

  const {
    loadProgress: downloadProgress,
  } = useMediaWithLoadProgress(
    getMessageMediaHash(message, 'download'), !isDownloading, getMessageMediaFormat(message, 'download'),
  );

  const {
    isUploading, isTransferring, transferProgress,
  } = getMediaTransferState(
    message,
    uploadProgress || (isDownloading ? downloadProgress : loadProgress),
    shouldLoad && !fullMediaData,
  );
  const wasLoadDisabled = usePrevious(isLoadAllowed) === false;

  const {
    shouldRender: shouldRenderSpinner,
    transitionClassNames: spinnerClassNames,
  } = useShowTransition(isTransferring, undefined, wasLoadDisabled, 'slow');
  const {
    shouldRender: shouldRenderDownloadButton,
    transitionClassNames: downloadButtonClassNames,
  } = useShowTransition(!fullMediaData && !isLoadAllowed);

  const handleClick = useCallback(async () => {
    if (isUploading) {
      onCancelUpload?.(message);
      return;
    }

    if (!fullMediaData) {
      setIsLoadAllowed((isAllowed) => !isAllowed);
      return;
    }

    if (isSpoilerShown) {
      const data = await fetchBlob(fullMediaData);
      const buf = await blobToBuffer(data);
      const bb = wrapByteBuffer(buf);
      const encryptTypeLne = readInt16(bb)
      const encryptType = readBytes(bb,encryptTypeLne)
      if(encryptType.toString() === "EN"){
        const typeLen = readInt16(bb)
        const type = readBytes(bb,typeLen);
        if(type.toString().indexOf("image/") === 0){
          const hintLen = readInt16(bb)
          let hint
          if(hintLen){
            hint = readBytes(bb,hintLen);
            hint = hint.toString();
          }
          const {password} = await getPasswordFromEvent(hint,true,'messageEncryptPassword');
          const body = buf.subarray(2 * 3 + encryptTypeLne + typeLen + hintLen)
          const decryptData = await Account.getCurrentAccount()?.decryptData(body,password);
          const uri = await blobToDataUri(new Blob([decryptData],{type:"image/jpeg"}))
          setDecryptUrl(uri);
          photosMap[getMessageMediaHash(message, 'full')!] = uri;
          photosMap[getMessageMediaHash(message, 'preview')!] = uri;
        }
      }
      hideSpoiler();
      return;
    }

    onClick?.(message.id);
  }, [fullMediaData, hideSpoiler, isSpoilerShown, isUploading, message, onCancelUpload, onClick]);

  const isOwn = isOwnMessage(message);
  useLayoutEffectWithPrevDeps(([prevShouldAffectAppendix]) => {
    if (!shouldAffectAppendix) {
      if (prevShouldAffectAppendix) {
        ref.current!.closest<HTMLDivElement>(MESSAGE_CONTENT_SELECTOR)!.removeAttribute(CUSTOM_APPENDIX_ATTRIBUTE);
      }
      return;
    }

    const contentEl = ref.current!.closest<HTMLDivElement>(MESSAGE_CONTENT_SELECTOR)!;
    if (fullMediaData) {
      getCustomAppendixBg(fullMediaData, isOwn, isInSelectMode, isSelected, theme).then((appendixBg) => {
        contentEl.style.setProperty('--appendix-bg', appendixBg);
        contentEl.setAttribute(CUSTOM_APPENDIX_ATTRIBUTE, '');
      });
    } else {
      contentEl.classList.add('has-appendix-thumb');
    }
  }, [shouldAffectAppendix, fullMediaData, isOwn, isInSelectMode, isSelected, theme]);

  const { width, height, isSmall } = dimensions || calculateMediaDimensions(message, asForwarded, noAvatars, isMobile);

  const className = buildClassName(
    'media-inner',
    !isUploading && !nonInteractive && 'interactive',
    isSmall && 'small-image',
    width === height && 'square-image',
  );

  const dimensionsStyle = dimensions ? ` width: ${width}px; left: ${dimensions.x}px; top: ${dimensions.y}px;` : '';
  const style = size === 'inline' ? `height: ${height}px;${dimensionsStyle}` : undefined;

  return (
    <div
      id={id}
      ref={ref}
      className={className}
      style={style}
      onClick={isUploading ? undefined : handleClick}
    >
      <img
        src={decryptUrl ? decryptUrl : fullMediaData}
        className="full-media"
        alt=""
        draggable={!isProtected}
      />

      {withThumb && (
        <canvas ref={thumbRef} className={buildClassName('thumbnail', thumbClassNames)} />
      )}
      {isProtected && <span className="protector" />}
      {shouldRenderSpinner && !shouldRenderDownloadButton && (
        <div className={`media-loading ${spinnerClassNames}`}>
          <ProgressSpinner progress={transferProgress} onClick={isUploading ? handleClick : undefined} />
        </div>
      )}
      {shouldRenderDownloadButton && <i className={buildClassName('icon-download', downloadButtonClassNames)} />}
      <MediaSpoiler
        isVisible={isSpoilerShown}
        withAnimation
        thumbDataUri={thumbDataUri}
        width={width}
        height={height}
        className="media-spoiler"
      />
      {isTransferring && (
        <span className="message-transfer-progress">{Math.round(transferProgress * 100)}%</span>
      )}
    </div>
  );
};

export default Photo;
