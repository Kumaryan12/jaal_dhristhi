import { Suspense } from 'react';

import { NetworkExplorer } from '../../components/network-explorer';

export default function NetworkPage() {
  return (
    <Suspense>
      <NetworkExplorer />
    </Suspense>
  );
}
