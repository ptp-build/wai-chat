import type {FC} from '../../../lib/teact/teact';
import React, {memo, useCallback, useEffect, useState,} from '../../../lib/teact/teact';
import {getActions, withGlobal} from '../../../global';

import {ChatCreationProgress} from '../../../types';

import {selectTabState} from '../../../global/selectors';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';

import InputText from '../../ui/InputText';
import FloatingActionButton from '../../ui/FloatingActionButton';
import Spinner from '../../ui/Spinner';
import Button from '../../ui/Button';
import ListItem from '../../ui/ListItem';
import PrivateChatInfo from '../../common/PrivateChatInfo';
import TextArea from "../../ui/TextArea";
import Checkbox from "../../ui/Checkbox";
import MsgDispatcher from "../../../worker/msg/MsgDispatcher";

export type OwnProps = {
  isChannel?: boolean;
  isActive: boolean;
  memberIds: string[];
  onReset: (forceReturnToChatList?: boolean) => void;
};

type StateProps = {
  creationProgress?: ChatCreationProgress;
  creationError?: string;
  maxGroupSize?: number;
};

const NewChatStep2: FC<OwnProps & StateProps > = ({
  isChannel,
  isActive,
  memberIds,
  maxGroupSize,
  creationProgress,
  creationError,
  onReset,
}) => {
  const {
    createGroupChat,
    createChannel,
    createChat,
  } = getActions();

  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const [title, setTitle] = useState('');
  const [enableAi, setEnableAi] = useState(true);
  const [about, setAbout] = useState('');
  const [username, setUsername] = useState('');
  const [photo, setPhoto] = useState<File | undefined>();
  const [error, setError] = useState<string | undefined>();

  const chatTitleEmptyError = 'Chat title can\'t be empty';
  const channelTitleEmptyError = 'Channel title can\'t be empty';

  const isLoading = creationProgress === ChatCreationProgress.InProgress;

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.currentTarget;
    const newValue = value.replace(/^\s+/, '');

    setTitle(newValue);

    if (newValue !== value) {
      e.currentTarget.value = newValue;
    }
  }, []);


  const handleEnableAi = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEnableAi(!enableAi);
  }, [enableAi]);


  const handleUsername = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
  }, [username]);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAbout(e.currentTarget.value);
  }, []);

  const handleCreateChannel = useCallback(() => {

    if (username.length > 0) {
      if(!username.endsWith("_bot")){
        MsgDispatcher.showNotification("用户名需要以 '_bot' 结尾, 如: wai_pay_support_bot 或者不填写");
        return;
      }
    }
    createChat({
      title,
      about,
      username,
      enableAi
    });
  }, [title,username,enableAi,createChannel, about, photo, memberIds, channelTitleEmptyError]);

  useEffect(() => {
    if (creationProgress === ChatCreationProgress.Complete) {
      onReset(true);
    }
  }, [creationProgress, onReset]);

  const renderedError = (creationError && lang(creationError)) || (
    error !== chatTitleEmptyError && error !== channelTitleEmptyError
      ? error
      : undefined
  );

  return (
    <div className="NewChat">
      <div className="left-header">
        <Button
          round
          size="smaller"
          color="translucent"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onReset()}
          ariaLabel="Return to member selection"
        >
          <i className="icon-arrow-left" />
        </Button>
        <h3>新建机器人</h3>
      </div>
      <div className="NewChat-inner step-2 pt-3">
        {/*<AvatarEditable*/}
        {/*  onChange={setPhoto}*/}
        {/*  title={lang('AddPhoto')}*/}
        {/*/>*/}

        <InputText
          value={title}
          onChange={handleTitleChange}
          label={"名称"}
          error={error === chatTitleEmptyError || error === channelTitleEmptyError ? error : undefined}
        />

        <TextArea
          helper={"如: wai_pay_support_bot 或者 不填写"}
          value={username}
          onChange={handleUsername}
          label={"用户名"}
        />

        <TextArea
          value={about}
          onChange={handleDescriptionChange}
          label={"机器人描述(可选)"}
        />

        <Checkbox
          label={"ChatGpt"}
          checked={enableAi}
          onCheck={handleEnableAi}
        />

        {renderedError && (
          <p className="error">{renderedError}</p>
        )}

        {memberIds.length > 0 && (
          <>
            <h3 className="chat-members-heading">{lang('GroupInfo.ParticipantCount', memberIds.length, 'i')}</h3>

            <div className="chat-members-list custom-scroll">
              {memberIds.map((id) => (
                <ListItem inactive className="chat-item-clickable">
                  <PrivateChatInfo userId={id} />
                </ListItem>
              ))}
            </div>
          </>
        )}
      </div>

      <FloatingActionButton
        isShown={title.length !== 0}
        onClick={handleCreateChannel}
        disabled={isLoading}
        ariaLabel={"Create Bot"}
      >
        {isLoading ? (
          <Spinner color="white" />
        ) : (
          <i className="icon-arrow-right" />
        )}
      </FloatingActionButton>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      progress: creationProgress,
      error: creationError,
    } = selectTabState(global).chatCreation || {};

    return {
      creationProgress,
      creationError,
      maxGroupSize: global.config?.maxGroupSize,
    };
  },
)(NewChatStep2));
