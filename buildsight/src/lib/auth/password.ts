import bcrypt from "bcryptjs";

const ROUNDS = 12;

export const PASSWORD_MIN_LENGTH = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface PasswordPolicyResult {
  ok: boolean;
  problems: string[];
}

/** Minimum credential policy, enforced on sign-up and password change. */
export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    problems.push(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  if (!/[a-zA-Z]/.test(password)) problems.push("Include at least one letter.");
  if (!/[0-9]/.test(password)) problems.push("Include at least one number.");
  if (/^\s|\s$/.test(password)) problems.push("Remove leading or trailing whitespace.");
  return { ok: problems.length === 0, problems };
}
