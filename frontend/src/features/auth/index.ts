// Public surface of the auth feature.
// Other features must import from this barrel only — never from internal modules.
export { AuthLayout } from './components/AuthLayout';
export { AuthBootstrap } from './components/AuthBootstrap';
export { useCurrentUser } from './api/use-current-user';
export type { AuthUser, CurrentUserState } from './types';
