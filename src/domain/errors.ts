export class AccountNotFoundError extends Error {
  constructor(readonly accountId: string) {
    super(`Account ${accountId} not found`);
    this.name = "AccountNotFoundError";
  }
}
