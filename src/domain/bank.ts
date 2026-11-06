import {
  AccountNotFoundError,
  InsufficientFundsError,
  InvalidAmountError,
  SameAccountTransferError,
} from "./errors.js";

export interface Account {
  readonly id: string;
  readonly balance: number;
}

export interface TransferResult {
  readonly origin: Account;
  readonly destination: Account;
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
    assertValidAmount(amount);
    const current = this.#balances.get(accountId) ?? 0;
    return this.#setBalance(accountId, current + amount);
  }

  withdraw(accountId: string, amount: number): Account {
    assertValidAmount(amount);
    const current = this.balance(accountId);
    if (amount > current) {
      throw new InsufficientFundsError(accountId, current, amount);
    }
    return this.#setBalance(accountId, current - amount);
  }

  transfer(
    originId: string,
    destinationId: string,
    amount: number,
  ): TransferResult {
    assertValidAmount(amount);
    if (originId === destinationId) {
      throw new SameAccountTransferError(originId);
    }
    // Atomic without a rollback: every check that can fail runs inside
    // withdraw before it writes, and deposit cannot fail afterwards. Being
    // synchronous, nothing else can run between the two writes.
    const origin = this.withdraw(originId, amount);
    const destination = this.deposit(destinationId, amount);
    return { origin, destination };
  }

  reset(): void {
    this.#balances.clear();
  }

  #setBalance(accountId: string, balance: number): Account {
    this.#balances.set(accountId, balance);
    return { id: accountId, balance };
  }
}

// Safe integers only: beyond 2^53 a number can no longer represent every
// integer, so balances would silently lose precision.
function assertValidAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new InvalidAmountError(amount);
  }
}
