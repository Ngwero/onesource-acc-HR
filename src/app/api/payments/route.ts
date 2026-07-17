import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { paymentSchema } from "@/lib/validations";
import { createPaymentWithAllocations, listPayments } from "@/services/payment.service";

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();
    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Validation failed", parsed.error.issues);

    try {
      const payment = await createPaymentWithAllocations({
        userId: user.id,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        exchangeRate: parsed.data.exchangeRate,
        paymentMethod: parsed.data.paymentMethod,
        payableId: parsed.data.payableId,
        receivableId: parsed.data.receivableId,
        bankAccountId: parsed.data.bankAccountId,
        reference: parsed.data.reference,
        notes: parsed.data.notes,
        allocations: parsed.data.allocations,
      });

      return successResponse(payment, "Payment recorded", 201);
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Payment failed");
    }
  },
  { module: "payments", action: "create" }
);

export const GET = withAuth(
  async () => successResponse(await listPayments()),
  { module: "payments", action: "read" }
);
