import { AccountNotFoundError } from "./errors.js";

export interface Account {
  readonly id: string;
  readonly balance: number;
}

export class Bank {
  readonly #balances = new Map<string, number>();

  balance(accountId: string): number {
    const balance = this.#balances.get(accountId);
    if (balance === undefined) {
      throw new AccountNotFoundError(accountId);
    }
    return balance;
  }

  deposit(accountId: string, amount: number): Account {
    const balance = (this.#balances.get(accountId) ?? 0) + amount;
    this.#balances.set(accountId, balance);
    return { id: accountId, balance };
  }
}
