import type {
  ChangeEvent, FormEvent, RefObject,
} from 'react';
import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';

type OwnProps = {
  ref?: RefObject<HTMLInputElement>;
  id?: string;
  className?: string;
  type?: string;
  value?: string;
  max?: number;
  min?: number;
  step?: number;
  label?: string;
  error?: string;
  success?: string;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  helper: string;
  tabIndex?: number;
  teactExperimentControlled?: boolean;
  inputMode?: 'text' | 'none' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onInput?: (e: FormEvent<HTMLInputElement>) => void;
  onKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
};

const InputText: FC<OwnProps> = ({
  ref,
  min,
  max,
  step,
  id,
  type,
  onFocus,
  className,
  value,
  label,
  error,
  success,
  disabled,
  readOnly,
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
  tabIndex,
  teactExperimentControlled,
  onChange,
  onInput,
  onKeyPress,
  onKeyDown,
  onBlur,
  onPaste,
  helper,
}) => {
  const lang = useLang();
  const labelText = error || success || label;
  const fullClassName = buildClassName(
    'input-group',
    value && 'touched',
    error ? 'error' : success && 'success',
    disabled && 'disabled',
    readOnly && 'disabled',
    labelText && 'with-label',
    className,
  );

  return (
    <div className={fullClassName} dir={lang.isRtl ? 'rtl' : undefined}>
      <input
        ref={ref}
        className="form-control"
        type={type || "text"}
        id={id}
        step={step}
        min={min}
        max={max}
        dir="auto"
        value={value ||( type === 'number' ? 0 : '')}
        tabIndex={tabIndex}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        inputMode={inputMode}
        disabled={disabled}
        readOnly={readOnly}
        onChange={onChange}
        onInput={onInput}
        onKeyPress={onKeyPress}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onPaste={onPaste}
        aria-label={labelText}
        teactExperimentControlled={teactExperimentControlled}
      />
      {labelText && (
        <label htmlFor={id}>{labelText}</label>
      )}
      {
        helper &&
        <div className="helper">{helper}</div>
      }
    </div>
  );
};

export default memo(InputText);
