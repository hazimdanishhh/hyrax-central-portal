// services/useEmployee.js
import { supabase } from "../../../../../lib/supabaseClient";

const FILTER_NULL = "__null__";
const FILTER_NOT_NULL = "__notnull__";

// Age bands: current_date - date_of_birth < 365.25 * N days -- mirrors
// get_hr_employees_dashboard_rpc.sql's ageDistributionData banding exactly,
// so an ageBand filter's row count always matches its chart bar.
const AGE_BAND_DAYS = {
  "< 25": { maxDays: 365.25 * 25 },
  "25-34": { minDays: 365.25 * 25, maxDays: 365.25 * 35 },
  "35-44": { minDays: 365.25 * 35, maxDays: 365.25 * 45 },
  "45-54": { minDays: 365.25 * 45, maxDays: 365.25 * 55 },
  "55+": { minDays: 365.25 * 55 },
  Unknown: null,
};

// Tenure bands: current_date - join_date < 365 * N days -- plain 365, NOT
// 365.25 (the RPC's tenureDistributionData deliberately uses whole years
// here, unlike ageDistributionData -- kept identical on purpose).
const TENURE_BAND_DAYS = {
  "< 1 year": { maxDays: 365 },
  "1-3 years": { minDays: 365, maxDays: 365 * 3 },
  "3-5 years": { minDays: 365 * 3, maxDays: 365 * 5 },
  "5-10 years": { minDays: 365 * 5, maxDays: 365 * 10 },
  "10+ years": { minDays: 365 * 10 },
  Unknown: null,
};

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function subDays(date, days) {
  return new Date(date.getTime() - Math.round(days) * 86400000);
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

// Translates a band label ("< 25", "10+ years", "Unknown", ...) into a
// date-column range/null filter, using the same day-count boundaries the
// RPC's own chart banding uses (see AGE_BAND_DAYS/TENURE_BAND_DAYS above).
function applyBandFilter(query, column, bandLabel, bandTable) {
  const band = bandTable[bandLabel];
  if (band === undefined) return query; // unrecognized label -- ignore
  if (band === null) return query.is(column, null); // "Unknown"

  const today = new Date();
  let q = query;
  if (band.maxDays !== undefined) {
    q = q.gt(column, toISODate(subDays(today, band.maxDays)));
  }
  if (band.minDays !== undefined) {
    q = q.lte(column, toISODate(subDays(today, band.minDays)));
  }
  return q;
}

/**
 * Service to fetch Employees for HR department
 * Server-side filtering and pagination
 */

export async function fetchEmployees({
  page,
  pageSize,
  search,
  filters,
  sortBy,
  sortOrder,
}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const f = filters || {};

  // employment_status is !inner because employment_status_id is a required
  // column (tableConfig.jsx marks it required, every employee is expected to
  // have one) -- this is what makes the statusBucket filter below actually
  // restrict the top-level rows instead of just nulling out the embedded
  // object on non-matching rows. Do NOT do the same for employment_type
  // below -- it's genuinely nullable (see "No Employment Type" filter), and
  // an unconditional !inner there would silently drop every employee with
  // no employment type from every query, not just filtered ones.
  // lifecycle_cases: NOT !inner -- a plain optional embed, filtered below
  // to OPEN rows only via the dot-path .eq() (same "filters the nested
  // list without excluding the parent row" mechanism statusBucket's own
  // comment documents for the !inner case, just the non-restricting mirror
  // of it). employee_lifecycle_cases is a real table with a real FK to
  // employees, so PostgREST can embed it directly here -- unlike
  // lifecycleCasesService.js's own case-list query, which has to resolve
  // employee identity via a separate employees_public batch fetch because
  // THAT query goes the other direction, off a VIEW with no FK for
  // PostgREST to detect.
  // "lifecycleCase" filter ("onboarding_open"/"offboarding_open") needs the
  // embed to become row-restricting -- the same !inner-vs-plain switch
  // statusBucket's own comment documents, just decided at select-string
  // build time here since (unlike statusBucket, which reuses the same
  // always-!inner employment_status embed for every request) this embed's
  // join type genuinely differs per request.
  const lifecycleCaseFilterValue = f.lifecycleCase;
  const lifecycleCasesEmbed = lifecycleCaseFilterValue
    ? "lifecycle_cases:employee_lifecycle_cases!inner (id,case_type,status)"
    : "lifecycle_cases:employee_lifecycle_cases (id,case_type,status)";

  let query = supabase
    .from("employees")
    .select(
      `
        *,
        profile:profile_id (*),
        identification_type:identification_type_id (id,name),
        nationality:nationality_id (id,name),
        department:departments (id,name,sub),
        work_location:work_locations (id,name,sub),
        personal_address:addresses (id,line1,line2,city,state,postcode,country),
        manager:manager_id (id,employee_id,full_name,preferred_name,email_work,phone_work,position,
          department:departments (id,name,sub)),
        employment_status:employment_status_id!inner (id,name,category),
        employment_type:employment_type_id (id,name),
        termination_reason:termination_reason_id (id,name
        ),
        ${lifecycleCasesEmbed}
      `,
      { count: "exact" },
    )
    .eq("lifecycle_cases.status", "OPEN")
    .order(sortBy, { ascending: sortOrder === "ascending" });

  if (lifecycleCaseFilterValue) {
    query = query.eq(
      "lifecycle_cases.case_type",
      lifecycleCaseFilterValue === "offboarding_open" ? "OFFBOARDING" : "ONBOARDING",
    );
  }

  // --- SEARCH ---
  if (search) {
    query = query.or(
      `employee_id.ilike.%${search}%,full_name.ilike.%${search}%`,
    );
  }

  // --- FILTERS ---

  // Simple single-column eq/is-null filters.
  const EQ_OR_NULL_MAP = {
    department: "department_id",
    employmentType: "employment_type_id",
    terminationReason: "termination_reason_id",
    nationality: "nationality_id",
    identificationType: "identification_type_id",
    maritalStatus: "marital_status",
    employmentStatus: "employment_status_id",
  };

  Object.entries(EQ_OR_NULL_MAP).forEach(([key, column]) => {
    const value = f[key];
    if (value === undefined || value === "") return;
    query = value === FILTER_NULL ? query.is(column, null) : query.eq(column, value);
  });

  // "manager"/"profile" additionally support __notnull__ ("Has Manager" /
  // "Has Profile Linked") alongside the standard __null__ sentinel --
  // needed for managementCoverageData's "Assigned" slice and noProfileCount.
  [
    { key: "manager", column: "manager_id" },
    { key: "profile", column: "profile_id" },
  ].forEach(({ key, column }) => {
    const value = f[key];
    if (value === undefined || value === "") return;
    if (value === FILTER_NULL) {
      query = query.is(column, null);
    } else if (value === FILTER_NOT_NULL) {
      query = query.not(column, "is", null);
    } else {
      query = query.eq(column, value);
    }
  });

  // "gender" -- "Not Specified" also matches true-NULL, since the
  // Overview's genderData chart merges coalesce(gender,'Not Specified')
  // into one bar (get_hr_employees_dashboard_rpc.sql) -- a plain
  // .eq("gender","Not Specified") would only reproduce half that bucket.
  if (f.gender !== undefined && f.gender !== "") {
    if (f.gender === FILTER_NULL) {
      query = query.is("gender", null);
    } else if (f.gender === "Not Specified") {
      query = query.or("gender.eq.Not Specified,gender.is.null");
    } else {
      query = query.eq("gender", f.gender);
    }
  }

  // "excludeEmploymentStatus" -- narrow negation used only by
  // statusMismatchCount's link (active bucket, overdue, but NOT Probation --
  // Probation-status overdue-unconfirmed people are lateConfirmationsCount's
  // bucket instead, mutually exclusive by the RPC's own construction).
  if (f.excludeEmploymentStatus) {
    query = query.neq("employment_status_id", f.excludeEmploymentStatus);
  }

  // "statusBucket" -- active/terminated/inactive, via the
  // employment_status.category column added in the employment-status-
  // consistency pass -- reused here instead of hardcoding the same 3 id
  // lists a 4th time. Any filter targeting an embedded resource's column
  // is applied by PostgREST as an inner-join-scoped condition for this
  // request only -- it doesn't change any other, unfiltered query's join
  // behavior.
  if (f.statusBucket) {
    query = query.eq("employment_status.category", f.statusBucket);
  }

  // "confirmationStatus" -- mirrors get_hr_employees_dashboard_rpc.sql's
  // confirmation_due_date = join_date + 6 months formula exactly, translated
  // into a join_date range so the two never disagree. Scope to a specific
  // employment status (e.g. Probation) via the existing employmentStatus
  // filter alongside this one, same way the RPC scopes
  // confirmationsDueSoonCount/lateConfirmationsCount to Probation
  // specifically -- not baked into this filter itself.
  if (f.confirmationStatus) {
    query = query.is("confirmation_date", null);
    const sixMonthsAgo = addMonths(new Date(), -6);
    if (f.confirmationStatus === "due_soon") {
      query = query
        .gte("join_date", toISODate(sixMonthsAgo))
        .lte("join_date", toISODate(subDays(sixMonthsAgo, -30)));
    } else if (f.confirmationStatus === "overdue") {
      query = query.lt("join_date", toISODate(sixMonthsAgo));
    }
    // "not_confirmed" -- confirmation_date IS NULL is the whole condition.
  }

  // "contractEndingSoon" -- mirrors contractActionsDueCount's end_date
  // window exactly. Scope to active employees via statusBucket=active
  // alongside this one (same composable-filters approach as
  // confirmationStatus above). Exclude-'full-time' rule, not an
  // include-'%contract%' match -- kept in sync with
  // check_employee_contract_actions_due.sql's own redesign (2026-09): the
  // "contract" substring match was confirmed against live data to be too
  // narrow (misses part-time/intern/temporary/etc.), and this filter had
  // drifted out of sync with that fix until now.
  //
  // Resolved via an upfront id lookup + .in() on the plain employment_type_id
  // column, NOT a dot-path filter into the employment_type embed --
  // employment_type_id is nullable, so marking that embed !inner (the only
  // way to make an embedded-column filter actually restrict top-level rows)
  // would silently drop every employee with no employment type from every
  // query on this page. This is the same bug statusBucket had before it was
  // switched to an !inner embed on the (required) employment_status column.
  if (f.contractEndingSoon) {
    const today = new Date();
    const days = parseInt(f.contractEndingSoon, 10) || 30;

    const { data: nonFullTimeTypes, error: employmentTypesError } = await supabase
      .from("employment_type")
      .select("id")
      .not("name", "ilike", "full-time");
    if (employmentTypesError) throw employmentTypesError;

    query = query
      .not("end_date", "is", null)
      .gte("end_date", toISODate(today))
      .lte("end_date", toISODate(subDays(today, -days)))
      .in("employment_type_id", (nonFullTimeTypes ?? []).map((t) => t.id));
  }

  // Hire-date range (join_date) -- same startDate/endDate keys every other
  // enableDateRange-powered page in this app uses.
  if (f.startDate) query = query.gte("join_date", f.startDate);
  if (f.endDate) query = query.lte("join_date", f.endDate);

  // Departure-date range, over coalesce(end_date, resignation_date) -- both
  // bounds required together (this compound OR condition doesn't have a
  // clean "only one bound set" shape worth supporting).
  if (f.departureDateFrom && f.departureDateTo) {
    query = query.or(
      `and(end_date.gte.${f.departureDateFrom},end_date.lte.${f.departureDateTo}),` +
        `and(end_date.is.null,resignation_date.gte.${f.departureDateFrom},resignation_date.lte.${f.departureDateTo})`,
    );
  }

  // "ageBand"/"tenureBand" -- see applyBandFilter above.
  if (f.ageBand) {
    query = applyBandFilter(query, "date_of_birth", f.ageBand, AGE_BAND_DAYS);
  }
  if (f.tenureBand) {
    query = applyBandFilter(query, "join_date", f.tenureBand, TENURE_BAND_DAYS);
  }

  // paginate LAST
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    data: data || [],
    totalCount: count || 0,
  };
}
