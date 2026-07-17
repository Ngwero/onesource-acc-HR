"use client";

import { useEffect, useState } from "react";
import { FormModal, FormField, FormActions } from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

type Opening = {
  id: string;
  openingNumber: string;
  title: string;
  status: string;
  location?: string | null;
  employmentType: string;
  _count?: { applicants: number };
  department?: { name: string } | null;
};

type Applicant = {
  id: string;
  applicantNumber: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  interviewAt?: string | null;
  jobOpening: { id: string; title: string; openingNumber: string };
};

type Dept = { id: string; name: string };

const APPLICANT_STATUSES = [
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
];

export default function RecruitmentPage() {
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [tab, setTab] = useState<"jobs" | "applicants">("jobs");
  const [showJob, setShowJob] = useState(false);
  const [showApp, setShowApp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [jobForm, setJobForm] = useState({
    title: "",
    departmentId: "",
    location: "",
    employmentType: "PERMANENT",
    description: "",
  });
  const [appForm, setAppForm] = useState({
    jobOpeningId: "",
    fullName: "",
    email: "",
    phone: "",
    source: "",
  });

  const load = () => {
    Promise.all([
      fetch("/api/hr/recruitment").then((r) => r.json()),
      fetch("/api/hr/applicants").then((r) => r.json()),
      fetch("/api/departments").then((r) => r.json()),
    ]).then(([j, a, d]) => {
      if (j.success) setOpenings(j.data);
      if (a.success) setApplicants(a.data);
      if (d.success) setDepartments(d.data);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const createJob = async () => {
    setLoading(true);
    const res = await fetch("/api/hr/recruitment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...jobForm,
        departmentId: jobForm.departmentId || undefined,
      }),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) {
      setShowJob(false);
      setJobForm({
        title: "",
        departmentId: "",
        location: "",
        employmentType: "PERMANENT",
        description: "",
      });
      setNotice("Job opening created");
      load();
    } else setNotice(res.message || "Failed");
  };

  const createApplicant = async () => {
    setLoading(true);
    const res = await fetch("/api/hr/applicants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(appForm),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) {
      setShowApp(false);
      setAppForm({ jobOpeningId: "", fullName: "", email: "", phone: "", source: "" });
      setNotice("Applicant added");
      load();
    } else setNotice(res.message || "Failed");
  };

  const updateApplicantStatus = async (id: string, status: string) => {
    const res = await fetch("/api/hr/applicants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    }).then((r) => r.json());
    if (res.success) {
      setNotice(`Moved to ${status}`);
      load();
    } else setNotice(res.message || "Failed");
  };

  const closeJob = async (id: string) => {
    const res = await fetch("/api/hr/recruitment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "CLOSED" }),
    }).then((r) => r.json());
    if (res.success) {
      setNotice("Opening closed");
      load();
    }
  };

  return (
    <div className="dash-page space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#5A6B5E]">Talent</p>
          <h1 className="dash-title mt-1 text-3xl font-semibold text-[#0F1F12]">Recruitment</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Job openings and applicant pipeline from applied to hired.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="dash-btn-secondary" onClick={() => setShowApp(true)}>
            Add applicant
          </button>
          <button type="button" className="dash-btn-primary" onClick={() => setShowJob(true)}>
            New opening
          </button>
        </div>
      </header>

      {notice && (
        <p className="rounded-lg bg-[#F3F8F0] px-4 py-2 text-sm text-[#105820]">{notice}</p>
      )}

      <div className="flex gap-2">
        {(["jobs", "applicants"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              tab === t ? "dash-btn-primary" : "dash-btn-secondary"
            }
          >
            {t === "jobs" ? `Openings (${openings.length})` : `Applicants (${applicants.length})`}
          </button>
        ))}
      </div>

      {tab === "jobs" ? (
        <div className="grid gap-4 md:grid-cols-2">
          {openings.map((o) => (
            <div key={o.id} className="dash-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">{o.openingNumber}</p>
                  <h3 className="mt-1 text-lg font-semibold text-[#0F1F12]">{o.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {o.department?.name || "No department"}
                    {o.location ? ` · ${o.location}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-[#F3F8F0] px-2.5 py-1 text-xs font-medium text-[#105820]">
                  {o.status}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span>{o._count?.applicants ?? 0} applicants</span>
                <span className="text-slate-500">{o.employmentType.replace(/_/g, " ")}</span>
              </div>
              {o.status === "OPEN" && (
                <button
                  type="button"
                  className="mt-4 text-sm font-medium text-[#105820] hover:underline"
                  onClick={() => closeJob(o.id)}
                >
                  Close opening
                </button>
              )}
            </div>
          ))}
          {openings.length === 0 && (
            <p className="col-span-full py-10 text-center text-slate-500">No job openings yet.</p>
          )}
        </div>
      ) : (
        <div className="dash-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Contact</th>
              </tr>
            </thead>
            <tbody>
              {applicants.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{a.fullName}</p>
                    <p className="text-xs text-slate-500">{a.applicantNumber}</p>
                  </td>
                  <td className="px-4 py-3">{a.jobOpening.title}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={a.status}
                      onChange={(e) => updateApplicantStatus(a.id, e.target.value)}
                    >
                      {APPLICANT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {a.email || a.phone || "—"}
                  </td>
                </tr>
              ))}
              {applicants.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    No applicants yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <FormModal open={showJob} onOpenChange={setShowJob} title="New job opening">
        <FormField label="Title">
          <Input value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} />
        </FormField>
        <FormField label="Department">
          <Select
            value={jobForm.departmentId}
            onChange={(e) => setJobForm({ ...jobForm, departmentId: e.target.value })}
          >
            <option value="">—</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Location">
          <Input value={jobForm.location} onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })} />
        </FormField>
        <FormField label="Type">
          <Select
            value={jobForm.employmentType}
            onChange={(e) => setJobForm({ ...jobForm, employmentType: e.target.value })}
          >
            {["PERMANENT", "FIXED_TERM", "PROBATION", "CONSULTANT", "INTERN"].map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Description">
          <Input
            value={jobForm.description}
            onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
          />
        </FormField>
        <FormActions onCancel={() => setShowJob(false)} onSubmit={createJob} loading={loading} submitLabel="Create" />
      </FormModal>

      <FormModal open={showApp} onOpenChange={setShowApp} title="Add applicant">
        <FormField label="Job opening">
          <Select
            value={appForm.jobOpeningId}
            onChange={(e) => setAppForm({ ...appForm, jobOpeningId: e.target.value })}
          >
            <option value="">Select…</option>
            {openings.filter((o) => o.status === "OPEN").map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Full name">
          <Input value={appForm.fullName} onChange={(e) => setAppForm({ ...appForm, fullName: e.target.value })} />
        </FormField>
        <FormField label="Email">
          <Input value={appForm.email} onChange={(e) => setAppForm({ ...appForm, email: e.target.value })} />
        </FormField>
        <FormField label="Phone">
          <Input value={appForm.phone} onChange={(e) => setAppForm({ ...appForm, phone: e.target.value })} />
        </FormField>
        <FormField label="Source">
          <Input value={appForm.source} onChange={(e) => setAppForm({ ...appForm, source: e.target.value })} />
        </FormField>
        <FormActions onCancel={() => setShowApp(false)} onSubmit={createApplicant} loading={loading} submitLabel="Add" />
      </FormModal>
    </div>
  );
}
