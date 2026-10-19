import { createOperationIdentity } from "../domain/identity.js";
import { DomainError } from "../domain/errors.js";
import type { AccountInput, AccountResult, AccountsStore } from "../infrastructure/firestore/accounts_store.js";

export interface AuthenticatedAccount {
  readonly uid: string;
  readonly claims: Record<string, unknown>;
  readonly displayName: string | null;
  readonly email: string | null;
  readonly avatarUrl: string | null;
}

export async function bootstrapAccount(
  store: AccountsStore,
  identity: AuthenticatedAccount,
  requestId: string,
  requested: Record<string, unknown>,
  now: string,
): Promise<AccountResult> {
  if (requested.uid !== undefined || requested.role !== undefined || requested.residentId !== undefined) {
    throw new DomainError("permission_denied", "Account identity and role are controlled by authentication");
  }
  const operation = createOperationIdentity(identity.uid, "bootstrapResident", requestId, requested);
  if (operation.actorId !== identity.uid) throw new DomainError("permission_denied", "Authenticated identity mismatch");
  const input: AccountInput = {
    uid: identity.uid,
    displayName: typeof requested.displayName === "string" && requested.displayName.trim() !== ""
      ? requested.displayName.trim()
      : identity.displayName ?? "EcoLoop resident",
    email: typeof requested.email === "string" ? requested.email : identity.email ?? "",
    avatarUrl: typeof requested.avatarUrl === "string" ? requested.avatarUrl : identity.avatarUrl,
    claims: identity.claims,
    now,
  };
  return store.bootstrap(input);
}
