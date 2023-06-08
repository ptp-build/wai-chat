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
import {getActions, withGlobal} from "../../global";
import {selectCurrentChat, selectIsForumPanelOpen, selectTabState} from "../../global/selectors";
import {IS_ANDROID, IS_IOS} from "../../util/environment";
import useAppLayout from "../../hooks/useAppLayout";

type OwnProps = {
  isShown: boolean;
  onNewPrivateChat: () => void;
  onNewChannel: () => void;
  onNewGroup: () => void;
};

type StateProps = {
  leftColumnWidth?:number
}

const NewChatButton: FC<OwnProps & StateProps> = ({
  isShown,
  onNewPrivateChat,
  onNewChannel,
  onNewGroup,
  leftColumnWidth,
}) => {
  const {loadAllChats,createChat,setLeftColumnWidth} = getActions();
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
  const { isMobile,isDesktop } = useAppLayout();

  const showPlus = (isMobile) || (!isDesktop)

  const toggleIsMenuOpen = useCallback(() => {
    if(!showPlus){
      if(!leftColumnWidth || leftColumnWidth && leftColumnWidth > 88){
        setLeftColumnWidth({leftColumnWidth: 88})
      }else{
        setLeftColumnWidth({leftColumnWidth:380})
      }
    }else{
      setIsMenuOpen(!isMenuOpen);
      onNewChannel();
      setTimeout(()=>{
        setIsMenuOpen(false);
      },200)
    }
    if(leftColumnWidth && leftColumnWidth <= 88){
      setLeftColumnWidth({leftColumnWidth:380})
    }else{
      setLeftColumnWidth({leftColumnWidth:88})
    }
  }, [isMenuOpen,leftColumnWidth]);

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
  const ariaLabel = !showPlus ? ((leftColumnWidth && leftColumnWidth <= 88 ) ? "打开边栏": "关闭边栏") : lang(isMenuOpen ? 'Close' : 'NewMessageTitle')
  return (
    <div className={fabClassName} dir={lang.isRtl ? 'rtl' : undefined}>
      <Button
        round
        color="primary"
        className={isMenuOpen ? 'active' : ''}
        onClick={toggleIsMenuOpen}
        ariaLabel={ariaLabel }
        tabIndex={-1}
      >
        {
          showPlus ?
            <>
              <i className="icon-add" />
              <i className="icon-close" />
            </>:
            <span className="sidebar-collapse">
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"
                   strokeLinejoin="round" className="h-4 w-4" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><rect
                x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
            </span>
        }
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



export default memo(withGlobal(
  (global): StateProps => {
    const {
      leftColumnWidth,
    } = global;

    return {
      leftColumnWidth
    };
  },
)(NewChatButton));
