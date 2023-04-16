import type {FC} from '../../lib/teact/teact';
import React, {memo, useCallback, useEffect, useState,} from '../../lib/teact/teact';

import useLang from '../../hooks/useLang';
import Modal from './Modal';
import PasswordMonkey from "../common/PasswordMonkey";
import PasswordForm from "../common/PasswordForm";
import {passwordCheck} from "../../worker/share/utils/helpers";
import InputText from "./InputText";

type OwnProps = {};

let onConfirm: Function | null = null

export type PasswordHelperType = undefined | "showMnemonic" | "messageEncryptPassword"

const PasswordModal: FC<OwnProps> = ({}: OwnProps) => {

  const [open, setOpen] = useState<boolean>(false);
  const [showHitInput, setShowHitInput] = useState<boolean>(false);
  const [passwordHelper, setPasswordHelper] = useState<PasswordHelperType>(undefined);
  const [validationError, setValidationError] = useState<string>('');
  const [hint, setHint] = useState<string>('');
  const [shouldShowPassword, setShouldShowPassword] = useState(false);
  const lang = useLang();

  const handleSubmit = useCallback((password) => {
    if (!passwordCheck(password)) {
      setValidationError(lang("PasswordTipsCheck"))
      return
    }
    if (onConfirm) {
      onConfirm({password, hint});
      setOpen(false)
    }
  }, [hint]);

  useEffect(() => {
    const evt = (e: Event) => {
      if (!open) {
        setOpen(true);
        // @ts-ignore
        onConfirm = e.detail.callback;
        // @ts-ignore
        setPasswordHelper(e.detail.passwordHelper)
        // @ts-ignore
        setHint(e.detail.hint)
        // @ts-ignore
        setShowHitInput(!e.detail.hideHitInput);
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
      hasCloseButton
      isOpen={open}
      onClose={() => {
        if (onConfirm) {
          onConfirm({password: "", hint: ""});
        }
        setOpen(false)
      }}
      title="Password"
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
          passwordHelper === "messageEncryptPassword" &&
          <div className="help_text pt-2 pb-4 pr-2">
            <ul>
              <li>{lang("PasswordTipsLocalStorage")}</li>
              <li>{lang("PasswordTipsLocalStorage1")}</li>
            </ul>
          </div>
        }
        {
          passwordHelper === "showMnemonic" &&
          <div className="help_text pt-2 pb-4 pr-2">
            <ul>
              <li>{lang("密码不会存储服务器,跟账户助记词直接相关，请牢记密码和妥善保管助记词")}</li>
            </ul>
          </div>
        }
      </div>
    </Modal>
  );
};

export default memo(PasswordModal);
