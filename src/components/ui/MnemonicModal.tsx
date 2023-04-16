import type {FC} from '../../lib/teact/teact';
import React, {memo, useCallback, useEffect, useState,} from '../../lib/teact/teact';
import Modal from './Modal';
import {getActions, withGlobal} from "../../global";
import {getPasswordFromEvent} from "../../worker/share/utils/password";
import Account from "../../worker/share/Account";
import Mnemonic from "../../lib/ptp/wallet/Mnemonic";
import {aesEncrypt} from "../../util/passcode";
import {hashSha256} from "../../worker/share/utils/helpers";
import {PbQrCode} from "../../lib/ptp/protobuf/PTPCommon";
import {QrCodeType} from "../../lib/ptp/protobuf/PTPCommon/types";
import QrCode from "../common/QrCode";

type OwnProps = {};
type StateProps = {
  showMnemonicModal?:boolean
};

const MnemonicModal: FC<OwnProps & StateProps> = ({showMnemonicModal}) => {
  const {updateGlobal,showNotification} = getActions();
  const [mnemonic,setMnemonic] = useState("");
  const [mnemonicEncrypt,setMnemonicEncrypt] = useState("");

  const onCloseModal = useCallback(async ()=>{
    setMnemonic("")
    setMnemonicEncrypt("")
    updateGlobal({showMnemonicModal:undefined})
  },[])

  useEffect(()=>{
    const init = async ()=>{
      const {password} = await getPasswordFromEvent(undefined,true,'showMnemonic')
      if(!password){
        updateGlobal({showMnemonicModal:undefined})
        return
      }
      const account = Account.getCurrentAccount();
      if(!account?.getSession()){
        updateGlobal({showMnemonicModal:undefined})
        return showNotification({message:"没有登录"})
      }
      const res = await account?.verifySession(account?.getSession(),password);
      if(!res){
        updateGlobal({showMnemonicModal:undefined})
        return showNotification({message:"密码不正确"})
      }
      const entropy = await Account.getCurrentAccount()!.getEntropy();
      const m = Mnemonic.fromEntropy(entropy);
      const words = m.getWords();
      const e = await aesEncrypt(words,Buffer.from(hashSha256(password),'hex'))
      setMnemonicEncrypt(Buffer.from(new PbQrCode({
        type:QrCodeType.QrCodeType_MNEMONIC,
        data:Buffer.from(e)
      }).pack().getPbData()).toString("hex"))
      setMnemonic(words);
    }
    if(showMnemonicModal){
      init();
    }

  },[showMnemonicModal])

  if(!mnemonic){
    return null
  }
  return (
    <Modal title={"助记词"} isOpen={!!showMnemonicModal} hasCloseButton={true} onClose={onCloseModal}>
      <QrCode content={mnemonicEncrypt} tips={mnemonic} />
    </Modal>
  )
};

export default memo(withGlobal<OwnProps>(
  (global ): StateProps => {
    const {
      showMnemonicModal,
    } = global;
    return {
      showMnemonicModal,
    };
  },
)(MnemonicModal));

