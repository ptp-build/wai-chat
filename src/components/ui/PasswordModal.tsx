import type {FC} from '../../lib/teact/teact';
import React, {memo, useCallback, useEffect, useState,} from '../../lib/teact/teact';

import useLang from '../../hooks/useLang';
import Modal from './Modal';
import PasswordMonkey from "../common/PasswordMonkey";
import PasswordForm from "../common/PasswordForm";
import {passwordCheck} from "../../worker/share/utils/helpers";
import InputText from "./InputText";
import {PasswordFromEventOptions} from "../../worker/share/utils/password";
import Mnemonic, {MnemonicLangEnum} from "../../lib/ptp/wallet/Mnemonic";
import {DEFAULT_LANG_MNEMONIC} from "../../worker/setting";

type OwnProps = {};

let onConfirm: Function | null = null

export type PasswordHelperType = "" | "showMnemonic" | "messageEncryptPassword"  | "mnemonicPassword"

const PasswordModal: FC<OwnProps> = ({}: OwnProps) => {

  const [open, setOpen] = useState<boolean>(false);
  const [title, setTitle] = useState<string>("Password");
  const [noBackdropClose, setNoBackdropClose] = useState<boolean>(false);

  const [showHitInput, setShowHitInput] = useState<boolean>(false);
  const [passwordHelper, setPasswordHelper] = useState<PasswordHelperType>("");
  const [mnemonicError, setMnemonicError] = useState<string>("");
  const [validationError, setValidationError] = useState<string>('');
  const [mnemonic, setMnemonic] = useState<string>('');
  const [hint, setHint] = useState<string>('');
  const [shouldShowPassword, setShouldShowPassword] = useState(false);
  const lang = useLang();

  const handleSubmit = useCallback((password) => {
    if("mnemonicPassword" === passwordHelper && mnemonic.trim().split(" ").length !== 12 ||  !new Mnemonic(mnemonic.trim(),DEFAULT_LANG_MNEMONIC as MnemonicLangEnum).checkMnemonic()){
      setMnemonicError("助记词不合法")
      return false
    }
    if (!passwordCheck(password)) {
      setValidationError(lang("PasswordTipsCheck"))
      return
    }
    if (onConfirm) {
      onConfirm({password, hint,mnemonic});
      setOpen(false)
    }
  }, [hint,passwordHelper,mnemonic]);

  useEffect(() => {
    const evt = (e: Event) => {
      if (!open) {
        setOpen(true);
        // @ts-ignore
        onConfirm = e.detail.callback;
        // @ts-ignore
        setNoBackdropClose(e.detail.noBackdropClose)
        // @ts-ignore
        setPasswordHelper(e.detail.passwordHelper)
        // @ts-ignore
        setHint(e.detail.hint)
        // @ts-ignore
        setShowHitInput(!e.detail.hideHitInput);
        // @ts-ignore
        const options:PasswordFromEventOptions = e.detail.options as PasswordFromEventOptions || {}
        const {title,mnemonic} = options
        if(title){
          setTitle(title)
        }
        if(mnemonic){
          setMnemonic(mnemonic)
        }
      }
    }
    document.addEventListener('password', evt);
    return () => {
      document.removeEventListener('password', evt);
    }
  }, [setHint, setShowHitInput, open])

  const handleClearError = useCallback(() => {
    setValidationError('');
  }, []);

  return (
    <Modal
      hasCloseButton={!noBackdropClose}
      isOpen={open}
      noBackdropClose={noBackdropClose}
      onClose={() => {
        if(noBackdropClose){
          return false
        }
        if (onConfirm) {
          onConfirm({password: "", hint: ""});
        }
        setOpen(false)
      }}
      title={title}
      className=""
    >
      <div className="settings-content password-form custom-scroll background">
        <div className="settings-content-header no-border">
          <PasswordMonkey isBig isPasswordVisible={shouldShowPassword}/>
        </div>
        <div className="pt-0 pb-0 mb-2 background">
          {
            showHitInput &&
            <InputText
              id="pwd-hint"
              type={"text"}
              label={lang("PasswordTipsLocalHint")}
              onChange={(e) => {
                setHint(e.target.value)
              }}
              value={hint}
              autoComplete="given-name"
            />
          }
          {
            ["mnemonicPassword"].includes(passwordHelper) &&
            <InputText
              error={mnemonicError}
              id="pwd-mnemonic"
              type={"text"}
              label={"助记词"}
              onFocus={()=>setMnemonicError("")}
              onChange={(e) => {
                setMnemonicError("")
                setMnemonic(e.target.value)
              }}
              value={mnemonic}
            />
          }
          <PasswordForm
            error={validationError}
            hint={(!showHitInput && hint) ? hint : lang("PasswordTipsLocalPlaceholder")}
            shouldDisablePasswordManager={true}
            submitLabel={lang('Next')}
            clearError={handleClearError}
            isLoading={false}
            isPasswordVisible={shouldShowPassword}
            shouldResetValue={true}
            onChangePasswordVisibility={setShouldShowPassword}
            onSubmit={handleSubmit}
          />
        </div>
        {
          ["messageEncryptPassword"].includes(passwordHelper) &&
          <div className="help_text pt-2 pb-4 pr-2">
            <ul>
              <li>{lang("PasswordTipsLocalStorage")}</li>
              <li>{lang("PasswordTipsLocalStorage1")}</li>
            </ul>
          </div>
        }
        {
          ["showMnemonic","mnemonicPassword"].includes(passwordHelper) &&
          <div className="help_text pt-2 pb-4 pr-2">
            <ul>
              <li>{lang("密码不会存储服务器，请牢记密码")}</li>
              <li>{lang("助记词代表账户，可用于跨设备登录，请妥善保管保存助记词")}</li>

            </ul>
          </div>
        }
      </div>
    </Modal>
  );
};

export default memo(PasswordModal);
