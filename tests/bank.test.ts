import { beforeEach, describe, expect, it } from "vitest";
import { Bank } from "../src/domain/bank.js";
import {
  AccountNotFoundError,
  InsufficientFundsError,
  InvalidAmountError,
  SameAccountTransferError,
} from "../src/domain/errors.js";

describe("Bank", () => {
  let bank: Bank;

  beforeEach(() => {
    bank = new Bank();
  });

  describe("balance", () => {
    it("throws AccountNotFoundError for a non-existing account", () => {
      expect(() => bank.balance("1234")).toThrow(AccountNotFoundError);
    });

    it("does not create the account when it is queried", () => {
      expect(() => bank.balance("1234")).toThrow(AccountNotFoundError);
      expect(() => bank.balance("1234")).toThrow(AccountNotFoundError);
    });
  });

  describe("deposit", () => {
    it("creates the account with the deposited amount", () => {
      const account = bank.deposit("100", 10);

      expect(account).toEqual({ id: "100", balance: 10 });
      expect(bank.balance("100")).toBe(10);
    });

    it("adds to the balance of an existing account", () => {
      bank.deposit("100", 10);

      const account = bank.deposit("100", 10);

      expect(account).toEqual({ id: "100", balance: 20 });
      expect(bank.balance("100")).toBe(20);
    });

    it("only changes the destination account", () => {
      bank.deposit("100", 10);
      bank.deposit("300", 5);

      expect(bank.balance("100")).toBe(10);
      expect(bank.balance("300")).toBe(5);
    });
  });

  describe("withdraw", () => {
    it("throws AccountNotFoundError and does not create the account", () => {
      expect(() => bank.withdraw("200", 10)).toThrow(AccountNotFoundError);
      expect(() => bank.balance("200")).toThrow(AccountNotFoundError);
    });

    it("subtracts the amount from the balance", () => {
      bank.deposit("100", 20);

      const account = bank.withdraw("100", 5);

      expect(account).toEqual({ id: "100", balance: 15 });
      expect(bank.balance("100")).toBe(15);
    });

    it("allows withdrawing the whole balance", () => {
      bank.deposit("100", 20);

      expect(bank.withdraw("100", 20)).toEqual({ id: "100", balance: 0 });
    });

    it("throws InsufficientFundsError and keeps the balance unchanged", () => {
      bank.deposit("100", 20);

      expect(() => bank.withdraw("100", 21)).toThrow(InsufficientFundsError);
      expect(bank.balance("100")).toBe(20);
    });
  });

  describe("transfer", () => {
    it("moves the amount from origin to a newly created destination", () => {
      bank.deposit("100", 15);

      const result = bank.transfer("100", "300", 15);

      expect(result).toEqual({
        origin: { id: "100", balance: 0 },
        destination: { id: "300", balance: 15 },
      });
      expect(bank.balance("100")).toBe(0);
      expect(bank.balance("300")).toBe(15);
    });

    it("adds to the balance of an existing destination", () => {
      bank.deposit("100", 15);
      bank.deposit("300", 5);

      bank.transfer("100", "300", 10);

      expect(bank.balance("100")).toBe(5);
      expect(bank.balance("300")).toBe(15);
    });

    it("throws AccountNotFoundError and does not create the destination", () => {
      expect(() => bank.transfer("200", "300", 15)).toThrow(
        AccountNotFoundError,
      );
      expect(() => bank.balance("300")).toThrow(AccountNotFoundError);
    });

    it("changes nothing when the origin has insufficient funds", () => {
      bank.deposit("100", 10);
      bank.deposit("300", 5);

      expect(() => bank.transfer("100", "300", 11)).toThrow(
        InsufficientFundsError,
      );
      expect(bank.balance("100")).toBe(10);
      expect(bank.balance("300")).toBe(5);
    });

    it("does not create the destination when the transfer fails", () => {
      bank.deposit("100", 10);

      expect(() => bank.transfer("100", "300", 11)).toThrow(
        InsufficientFundsError,
      );
      expect(() => bank.balance("300")).toThrow(AccountNotFoundError);
    });

    it("rejects a transfer to the same account and keeps the balance", () => {
      bank.deposit("100", 10);

      expect(() => bank.transfer("100", "100", 5)).toThrow(
        SameAccountTransferError,
      );
      expect(bank.balance("100")).toBe(10);
    });

    it("rejects a same-account transfer before checking the account exists", () => {
      expect(() => bank.transfer("999", "999", 5)).toThrow(
        SameAccountTransferError,
      );
    });
  });

  describe("amount validation", () => {
    const invalidAmounts = [
      ["zero", 0],
      ["negative", -5],
      ["decimal", 1.5],
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
      ["above MAX_SAFE_INTEGER", Number.MAX_SAFE_INTEGER + 1],
    ] as const;

    it.each(invalidAmounts)(
      "deposit rejects amount: %s (account not created)",
      (_label, amount) => {
        expect(() => bank.deposit("100", amount)).toThrow(InvalidAmountError);
        expect(() => bank.balance("100")).toThrow(AccountNotFoundError);
      },
    );

    it.each(invalidAmounts)(
      "withdraw rejects amount: %s (balance kept)",
      (_label, amount) => {
        bank.deposit("100", 10);

        expect(() => bank.withdraw("100", amount)).toThrow(InvalidAmountError);
        expect(bank.balance("100")).toBe(10);
      },
    );

    it.each(invalidAmounts)(
      "transfer rejects amount: %s (nothing changes)",
      (_label, amount) => {
        bank.deposit("100", 10);

        expect(() => bank.transfer("100", "300", amount)).toThrow(
          InvalidAmountError,
        );
        expect(bank.balance("100")).toBe(10);
        expect(() => bank.balance("300")).toThrow(AccountNotFoundError);
      },
    );

    it("checks the amount before the account exists on withdraw", () => {
      expect(() => bank.withdraw("200", 0)).toThrow(InvalidAmountError);
    });

    it("checks the amount before the same-account rule on transfer", () => {
      expect(() => bank.transfer("100", "100", 0)).toThrow(InvalidAmountError);
    });
  });

  describe("reset", () => {
    it("removes every account", () => {
      bank.deposit("100", 10);
      bank.deposit("300", 5);

      bank.reset();

      expect(() => bank.balance("100")).toThrow(AccountNotFoundError);
      expect(() => bank.balance("300")).toThrow(AccountNotFoundError);
    });
  });
});
