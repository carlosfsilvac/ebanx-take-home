export class AccountNotFoundError extends Error {
  constructor(readonly accountId: string) {
    super(`Account ${accountId} not found`);
    this.name = "AccountNotFoundError";
  }
}

export class InsufficientFundsError extends Error {
  constructor(
    readonly accountId: string,
    readonly balance: number,
    readonly amount: number,
  ) {
    super(
      `Account ${accountId} has balance ${balance}, cannot withdraw ${amount}`,
    );
    this.name = "InsufficientFundsError";
  }
}

export class SameAccountTransferError extends Error {
  constructor(readonly accountId: string) {
    super(`Cannot transfer from account ${accountId} to itself`);
    this.name = "SameAccountTransferError";
  }
}
