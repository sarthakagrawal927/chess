import { useEffect } from 'react';
import { saasmaker } from '../lib/saasmaker';

export function PageViewTracker() {
  useEffect(() => {
    saasmaker?.analytics.track({ name: 'page_view', url: window.location.pathname }).catch(() => {});
  }, []);

  return null;
}
