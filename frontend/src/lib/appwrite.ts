import { Client, Account, ID } from 'appwrite';

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;

/** True when Appwrite env vars are present so auth features can be enabled. */
export const isAppwriteConfigured = Boolean(
  endpoint && projectId && projectId !== 'your_project_id',
);

const client = new Client();
if (isAppwriteConfigured) {
  client.setEndpoint(endpoint as string).setProject(projectId as string);
}

export const account = new Account(client);
export { ID };
