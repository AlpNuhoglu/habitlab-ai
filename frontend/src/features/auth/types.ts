// GET /me response — backend entity is not exposed as an OpenAPI response schema
export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  timezone: string;
  locale: 'en' | 'tr';
  emailVerifiedAt: string | null;
  preferences: {
    ai_recommendations_enabled: boolean;
    experiments_opted_out: boolean;
    hints_include_notes: boolean;
    quiet_hours: { start: string; end: string };
  };
  createdAt: string;
  updatedAt: string;
}

export interface CurrentUserState {
  readonly user: AuthUser | null;
  readonly isAuthenticated: boolean;
  readonly isPending: boolean;
  readonly isError: boolean;
}
