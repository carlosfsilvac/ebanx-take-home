import { AccountNotFoundError, InsufficientFundsError } from "./errors.js";

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
    const current = this.#balances.get(accountId) ?? 0;
    return this.#setBalance(accountId, current + amount);
  }

  withdraw(accountId: string, amount: number): Account {
    const current = this.balance(accountId);
    if (amount > current) {
      throw new InsufficientFundsError(accountId, current, amount);
    }
    return this.#setBalance(accountId, current - amount);
  }

  #setBalance(accountId: string, balance: number): Account {
    this.#balances.set(accountId, balance);
    return { id: accountId, balance };
  }
}
