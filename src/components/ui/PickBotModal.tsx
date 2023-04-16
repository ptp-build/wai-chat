import type {FC} from '../../lib/teact/teact';
import React, {memo, useCallback, useState,} from '../../lib/teact/teact';
import {getActions, withGlobal} from "../../global";
import ChatOrUserPicker from "../common/ChatOrUserPicker";
import MsgCommandSetting from '../../worker/msg/MsgCommandSetting';

type OwnProps = {};
type StateProps = {
  botIds:string[],
  showPickBotModal?:boolean
};

const PickBotModal: FC<OwnProps & StateProps> = ({showPickBotModal,botIds}) => {
  const [search,setSearch] = useState("");
  const {updateGlobal} = getActions();

  const handleSelect = useCallback((userId: string) => {
    MsgCommandSetting.onSelectSyncBot(userId)
    updateGlobal({
      showPickBotModal:false
    })
  }, []);

  const handleClose = useCallback(() => {
    updateGlobal({
      showPickBotModal:false
    })
  }, []);

  return (
    <ChatOrUserPicker
      isOpen={!!showPickBotModal}
      chatOrUserIds={botIds}
      searchPlaceholder={"请选择要同步的机器人"}
      search={search}
      onSearchChange={setSearch}
      loadMore={()=>{}}
      onSelectChatOrUser={handleSelect}
      onClose={handleClose}
    />
  )
};

export default memo(withGlobal<OwnProps>(
  (global ): StateProps => {
    const {
      chatIdsDeleted,
      showPickBotModal,
      users:{
        byId:users
      }
    } = global;
    const botIds = Object.keys(users).filter(id=>id !== "1").filter(id=>!chatIdsDeleted.includes(id))
    return {
      botIds,
      showPickBotModal,
    };
  },
)(PickBotModal));

