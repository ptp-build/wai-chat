import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';
import Loading from '../ui/Loading';

const AuthSignPasswordAsync: FC = () => {
  const AuthSignPassword = useModuleLoader(Bundles.Auth, 'AuthSignPassword');

  return AuthSignPassword ? <AuthSignPassword /> : <Loading />;
};

export default memo(AuthSignPasswordAsync);
