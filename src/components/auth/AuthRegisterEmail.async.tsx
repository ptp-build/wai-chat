import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';
import Loading from '../ui/Loading';

const AuthRegisterEmailAsync: FC = () => {
  const AuthRegisterEmail = useModuleLoader(Bundles.Auth, 'AuthRegisterEmail');

  return AuthRegisterEmail ? <AuthRegisterEmail /> : <Loading />;
};

export default memo(AuthRegisterEmailAsync);
