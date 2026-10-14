export type AuthField = 'name' | 'username' | 'email' | 'password';
export type FieldErrors = Partial<Record<AuthField, string>>;

export function validateAuthField(
  field: AuthField,
  value: string,
  mode: 'login' | 'register',
  usernameOnly = false,
): string | undefined {
  const required = field !== 'email' || mode === 'login' || usernameOnly;
  if (!value.trim()) return required ? 'required' : undefined;
  if (field === 'name' && (value.trim().length < 2 || value.trim().length > 20)) return 'name';
  if (field === 'username' && !/^[a-zA-Z0-9][a-zA-Z0-9_.]{2,19}$/.test(value)) return 'username';
  if (
    field === 'email' &&
    mode === 'register' &&
    (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
  )
    return 'email';
  if (field === 'password' && (value.length > 200 || (mode === 'register' && value.length < 8))) return 'password';
  return undefined;
}
