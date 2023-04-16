import type { FC } from '../../lib/teact/teact';
import React, {
  useState, useEffect, memo, useCallback, useMemo,
} from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';

import './NewChatButton.scss';
import {getActions} from "../../global";

type OwnProps = {
  isShown: boolean;
  onNewPrivateChat: () => void;
  onNewChannel: () => void;
  onNewGroup: () => void;
};

const NewChatButton: FC<OwnProps> = ({
  isShown,
  onNewPrivateChat,
  onNewChannel,
  onNewGroup,
}) => {
  const {loadAllChats,createChat} = getActions();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (!isShown) {
      setIsMenuOpen(false);
    }
  }, [isShown]);

  const lang = useLang();

  const fabClassName = buildClassName(
    'NewChatButton',
    isShown && 'revealed',
    isMenuOpen && 'menu-is-open',
  );

  const toggleIsMenuOpen = useCallback(() => {
    setIsMenuOpen(!isMenuOpen);
    onNewChannel();
    setTimeout(()=>{
      setIsMenuOpen(false);
    },200)
  }, [isMenuOpen]);

  const handleClose = useCallback(() => {
    setIsMenuOpen(false);
  }, []);


  const menuItems = useMemo(() => (
    <>
      <MenuItem icon="channel" onClick={onNewChannel}>{lang('NewChannel')}</MenuItem>
      <MenuItem icon="group" onClick={onNewGroup}>{lang('NewGroup')}</MenuItem>
      <MenuItem icon="user" onClick={onNewPrivateChat}>{lang('NewMessageTitle')}</MenuItem>
    </>
  ), [lang, onNewChannel, onNewGroup, onNewPrivateChat]);

  return (
    <div className={fabClassName} dir={lang.isRtl ? 'rtl' : undefined}>
      <Button
        round
        color="primary"
        className={isMenuOpen ? 'active' : ''}
        onClick={toggleIsMenuOpen}
        ariaLabel={lang(isMenuOpen ? 'Close' : 'NewMessageTitle')}
        tabIndex={-1}
      >
        <i className="icon-add" />
        <i className="icon-close" />
      </Button>
      <Menu
        isOpen={false}
        positionX={lang.isRtl ? 'left' : 'right'}
        positionY="bottom"
        autoClose
        onClose={handleClose}
      >
        {menuItems}
      </Menu>
    </div>
  );
};

export default memo(NewChatButton);
