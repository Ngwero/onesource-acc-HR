export type PaymentAllocationInput = {
  payableId?: string;
  receivableId?: string;
  amount: number;
};

export function normalizePaymentAllocations(input: {
  amount: number;
  payableId?: string;
  receivableId?: string;
  allocations?: PaymentAllocationInput[];
}): PaymentAllocationInput[] {
  if (input.allocations && input.allocations.length > 0) {
    return input.allocations;
  }

  if (input.payableId) {
    return [{ payableId: input.payableId, amount: input.amount }];
  }

  if (input.receivableId) {
    return [{ receivableId: input.receivableId, amount: input.amount }];
  }

  throw new Error("At least one allocation or payable/receivable target is required");
}

export function validatePaymentAllocations(
  totalAmount: number,
  allocations: PaymentAllocationInput[],
  options?: { allowPartial?: boolean; allowOverpay?: boolean }
): void {
  if (allocations.length === 0) {
    throw new Error("At least one allocation is required");
  }

  for (const alloc of allocations) {
    if (!alloc.payableId && !alloc.receivableId) {
      throw new Error("Each allocation must target a payable or receivable");
    }
    if (alloc.payableId && alloc.receivableId) {
      throw new Error("Allocation cannot target both payable and receivable");
    }
    if (alloc.amount <= 0) {
      throw new Error("Allocation amounts must be positive");
    }
  }

  const allocated = allocations.reduce((sum, a) => sum + a.amount, 0);
  if (options?.allowPartial) {
    if (allocated > totalAmount + 0.01) {
      throw new Error(
        `Allocation total (${allocated.toFixed(2)}) cannot exceed payment amount (${totalAmount.toFixed(2)})`
      );
    }
    return;
  }

  if (Math.abs(allocated - totalAmount) > 0.01) {
    throw new Error(
      `Allocation total (${allocated.toFixed(2)}) must equal payment amount (${totalAmount.toFixed(2)})`
    );
  }
}

export function isOutflowTransaction(type: string): boolean {
  return ["WITHDRAWAL", "PAYMENT", "FEE", "TRANSFER"].includes(type);
}
