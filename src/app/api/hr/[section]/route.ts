import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import * as hrx from "@/services/hr-extended.service";

type Section =
  | "holidays"
  | "contracts"
  | "recruitment"
  | "applicants"
  | "performance"
  | "training"
  | "enrollments"
  | "disciplinary"
  | "checklists"
  | "org"
  | "reports";

export const GET = withAuth(
  async ({ request }, _req, params) => {
    const section = params!.section as Section;
    const { searchParams } = new URL(request.url);

    try {
      switch (section) {
        case "holidays":
          return successResponse(
            await hrx.listHolidays(
              searchParams.get("year")
                ? Number(searchParams.get("year"))
                : undefined
            )
          );
        case "contracts":
          return successResponse(
            await hrx.listContracts({
              employeeId: searchParams.get("employeeId") || undefined,
              status: searchParams.get("status") || undefined,
            })
          );
        case "recruitment":
          return successResponse(
            await hrx.listJobOpenings(searchParams.get("status") || undefined)
          );
        case "applicants":
          return successResponse(
            await hrx.listApplicants({
              jobOpeningId: searchParams.get("jobOpeningId") || undefined,
              status: searchParams.get("status") || undefined,
            })
          );
        case "performance":
          return successResponse(
            await hrx.listPerformanceReviews({
              employeeId: searchParams.get("employeeId") || undefined,
              status: searchParams.get("status") || undefined,
            })
          );
        case "training":
          return successResponse(await hrx.listTrainingPrograms());
        case "enrollments":
          return successResponse(
            await hrx.listEmployeeTrainings({
              employeeId: searchParams.get("employeeId") || undefined,
              status: searchParams.get("status") || undefined,
            })
          );
        case "disciplinary":
          return successResponse(
            await hrx.listDisciplinary({
              employeeId: searchParams.get("employeeId") || undefined,
            })
          );
        case "checklists": {
          const employeeId = searchParams.get("employeeId");
          const kind = (searchParams.get("kind") || "ONBOARDING") as
            | "ONBOARDING"
            | "OFFBOARDING";
          if (!employeeId) return errorResponse("employeeId required");
          return successResponse(await hrx.ensureEmployeeChecklist(employeeId, kind));
        }
        case "org":
          return successResponse(await hrx.getOrgChart());
        case "reports":
          return successResponse(await hrx.getHrReports());
        default:
          return errorResponse("Unknown HR section", [], 404);
      }
    } catch (err) {
      console.error(`HR GET ${section}:`, err);
      return errorResponse(
        err instanceof Error ? err.message : "Failed to load",
        [],
        500
      );
    }
  },
  { module: "employees", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }, _req, params) => {
    const section = params!.section as Section;
    const body = await request.json();

    try {
      switch (section) {
        case "holidays":
          if (body.action === "seed") {
            return successResponse(
              await hrx.ensureUgandaPublicHolidays(body.year),
              "Public holidays seeded"
            );
          }
          return successResponse(await hrx.createHoliday(body), "Holiday created", 201);
        case "contracts":
          return successResponse(
            await hrx.createContract(body, user.id),
            "Contract created",
            201
          );
        case "recruitment":
          return successResponse(
            await hrx.createJobOpening(body, user.id),
            "Job opening created",
            201
          );
        case "applicants":
          return successResponse(
            await hrx.createApplicant(body),
            "Applicant added",
            201
          );
        case "performance":
          return successResponse(
            await hrx.createPerformanceReview(body, user.id),
            "Review created",
            201
          );
        case "training":
          return successResponse(
            await hrx.createTrainingProgram(body, user.id),
            "Training program created",
            201
          );
        case "enrollments":
          return successResponse(
            await hrx.enrollEmployeeTraining(body),
            "Employee enrolled",
            201
          );
        case "disciplinary":
          return successResponse(
            await hrx.createDisciplinary(body, user.id),
            "Disciplinary action recorded",
            201
          );
        case "checklists":
          return successResponse(
            await hrx.ensureEmployeeChecklist(body.employeeId, body.kind || "ONBOARDING"),
            "Checklist ready"
          );
        case "org":
          return successResponse(
            await hrx.setEmployeeManager(body.employeeId, body.reportsToId ?? null, user.id),
            "Reporting line updated"
          );
        default:
          return errorResponse("Unknown HR section", [], 404);
      }
    } catch (err) {
      console.error(`HR POST ${section}:`, err);
      return errorResponse(err instanceof Error ? err.message : "Create failed");
    }
  },
  { module: "employees", action: "create" }
);

export const PATCH = withAuth(
  async ({ user, request }, _req, params) => {
    const section = params!.section as Section;
    const body = await request.json();
    const id = body.id as string;
    if (!id && section !== "org") return errorResponse("id required");

    try {
      switch (section) {
        case "contracts":
          return successResponse(
            await hrx.updateContract(id, body, user.id),
            "Contract updated"
          );
        case "recruitment":
          return successResponse(await hrx.updateJobOpening(id, body), "Opening updated");
        case "applicants":
          return successResponse(await hrx.updateApplicant(id, body), "Applicant updated");
        case "performance":
          return successResponse(
            await hrx.updatePerformanceReview(id, body),
            "Review updated"
          );
        case "enrollments":
          return successResponse(
            await hrx.updateEmployeeTraining(id, body),
            "Enrollment updated"
          );
        case "checklists":
          return successResponse(
            await hrx.updateChecklistItem(id, {
              status: body.status,
              notes: body.notes,
            }),
            "Checklist item updated"
          );
        case "org":
          return successResponse(
            await hrx.setEmployeeManager(body.employeeId, body.reportsToId ?? null, user.id),
            "Reporting line updated"
          );
        default:
          return errorResponse("Update not supported for this section");
      }
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Update failed");
    }
  },
  { module: "employees", action: "update" }
);

export const DELETE = withAuth(
  async ({ request }, _req, params) => {
    const section = params!.section as Section;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return errorResponse("id required");

    try {
      if (section === "holidays") {
        return successResponse(await hrx.deleteHoliday(id), "Holiday deleted");
      }
      return errorResponse("Delete not supported for this section");
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Delete failed");
    }
  },
  { module: "employees", action: "delete" }
);
