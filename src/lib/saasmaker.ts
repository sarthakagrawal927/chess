import { SaaSMakerClient } from '@saas-maker/sdk';

export const saasmaker = new SaaSMakerClient({
  apiKey: import.meta.env.VITE_SAASMAKER_API_KEY,
  baseUrl: 'https://api.sassmaker.com',
});
