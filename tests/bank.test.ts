import { beforeEach, describe, expect, it } from "vitest";
import { Bank } from "../src/domain/bank.js";
import { AccountNotFoundError } from "../src/domain/errors.js";

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
});
