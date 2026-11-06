import { beforeEach, describe, expect, it } from "vitest";
import { Bank } from "../src/domain/bank.js";
import {
  AccountNotFoundError,
  InsufficientFundsError,
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
});
