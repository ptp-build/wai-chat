import type {FC} from '../../lib/teact/teact';
import React, {useCallback, useEffect, useRef,} from '../../lib/teact/teact';
import buildClassName from '../../util/buildClassName';
import useFlag from '../../hooks/useFlag';
import useMediaTransition from '../../hooks/useMediaTransition';
import useAsync from '../../hooks/useAsync';

import Loading from '../ui/Loading';

import blankUrl from '../../assets/blank.png';
import Button from "../ui/Button";

type OwnProps ={ content?:string,tips?:string};

const DATA_PREFIX = 'wai://';
const QR_SIZE = 280;

let qrCodeStylingPromise: Promise<typeof import('qr-code-styling')>;

function ensureQrCodeStyling() {
  if (!qrCodeStylingPromise) {
    qrCodeStylingPromise = import('qr-code-styling');
  }
  return qrCodeStylingPromise;
}

const QrCode: FC<OwnProps> = ({content,tips}) => {

  // @ts-ignore
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [isQrMounted, markQrMounted, unmarkQrMounted] = useFlag();

  const { result: qrCode } = useAsync(async () => {
    const QrCodeStyling = (await ensureQrCodeStyling()).default;
    return new QrCodeStyling({
      width: QR_SIZE,
      height: QR_SIZE,
      // image: blankUrl,
      margin: 10,
      type: 'svg',
      dotsOptions: {
        type: 'rounded',
      },
      cornersSquareOptions: {
        type: 'extra-rounded',
      },
      imageOptions: {
        imageSize: 0.4,
        margin: 8,
      },
      qrOptions: {
        errorCorrectionLevel: 'M',
      },
    });
  }, []);

  const transitionClassNames = useMediaTransition(isQrMounted);

  useEffect(() => {
    if (!qrCode) {
      return () => {
        unmarkQrMounted();
      };
    }

    const container = qrCodeRef.current!;
    const data = `${DATA_PREFIX}${content}`;
    qrCode.update({
      data,
    });

    if (!isQrMounted) {
      qrCode.append(container);
      markQrMounted();
    }
    return undefined;
  }, [content,isQrMounted, markQrMounted, unmarkQrMounted, qrCode]);
  const onDownload = useCallback(()=>{
    if(qrCode){
      qrCode.download()
    }
  },[qrCode])
  return (
    <div id="auth-qr-form" className="custom-scroll">
      <div className="qr-outer">
        <div
          className={buildClassName('qr-inner', transitionClassNames)}
          key="qr-inner"
        >
          <div
            key="qr-container"
            className="qr-container"
            ref={qrCodeRef}
            style={`width: ${QR_SIZE}px; height: ${QR_SIZE}px`}
          />
        </div>
        {!isQrMounted && <div className="qr-loading"><Loading /></div>}
      </div>
      <div className={'pt-2'} style={"text-align:center"}><code>{tips}</code></div>

      <Button isText disabled={!isQrMounted} onClick={onDownload}>下载</Button>
    </div>
  );
};

export default QrCode;
