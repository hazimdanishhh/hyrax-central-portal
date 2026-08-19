import {
  HandshakeIcon,
  LinkIcon,
  ReceiptIcon,
  ChartBarIcon,
  UsersIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";

// Static, developer-maintained guide content for the Sales module -- see
// docs/SALES-ORDER-PIPELINE-ROADMAP.md for the underlying source-of-truth
// this content is drawn from. Each topic is one guide; each step is
// { title, body (markdown), media? }. media is an array of
// { type: "image" | "video", url, caption }, 0 or more per step -- e.g.:
//
//   media: [
//     { type: "image", url: "https://.../screenshot.png", caption: "The WON action modal" },
//     { type: "video", url: "https://drive.google.com/file/d/FILE_ID/view", caption: "Marking a lead as Won" },
//   ]
//
// No media has been attached yet in any step below -- add real screenshots/
// recordings here as they're produced; GuideStepList.jsx already knows how
// to render both image and video (YouTube/Vimeo/Drive link, or a direct
// file URL) without any other code changes.
export const salesGuideTopics = [
  {
    id: "leads-pipeline",
    label: "Sales Leads Pipeline",
    icon: HandshakeIcon,
    description:
      "How a lead moves from first contact through to a won or lost deal, and exactly what's required at each step.",
    steps: [
      {
        title: "Create a new lead",
        body: `Every deal starts as a lead under **Sales → Leads → All Leads**, using the **Add Lead** button.

A lead must reference exactly one account — never both:
- A **Prospect** (a native account you've created yourself, before it exists in SAP), or
- A **real SAP Customer** (an account that already exists in SAP B1).

You'll also set the lead's **Owner**, **Product Type** (Transformer Oils, Lubricants, or Mixed), **Expected Revenue**, and **Close Probability** — these drive the Pipeline forecasts on the Sales Reports dashboard.`,
      },
      {
        title: "Progress through Discovery, Sample Test, and Proposal",
        body: `A lead starts at **Discovery**. From there it can move to:
- **Sample Test**, then **Proposal** — the normal path when a physical sample needs testing first, or
- **Proposal** directly — Sample Test can be skipped entirely if it isn't needed for that deal.

Use the stage buttons on the lead's detail sidebar to move it forward. There's no requirement to fill in anything extra at these early stages.`,
      },
      {
        title: "Negotiation — attach the Quotation",
        body: `Moving a lead to **Negotiation** requires a **Quotation Document** — attach the quotation file (via the Google Drive picker) before the stage change is accepted.

Quotations in this portal are **not** generated from SAP — Hyrax doesn't use SAP B1's own Quotation module. The quotation is simply the Drive-linked document you attach here.

You can update the attached quotation later at any time using the **Edit Quotation** button on the lead's sidebar, without changing the lead's stage.`,
      },
      {
        title: "Mark as Won — capture the PO details",
        body: `Marking a lead **Won** requires three things, all captured in the same action:
1. **Actual Revenue** (RM) — the real, confirmed deal value.
2. **PO Number** — the customer's purchase order number, typed exactly as it will appear on the SAP sales order. Get this exactly right — it's how this portal automatically matches your lead to the real SAP order later (see the "PO Number & SAP Order Matching" guide).
3. **PO Document** — the customer's actual purchase order file, attached via the Google Drive picker.

Once a lead is Won, it's terminal — there's no further stage to move it to.`,
      },
      {
        title: "Mark as Lost",
        body: `If a deal doesn't close, mark the lead **Lost** and select a **Lose Reason** from the dropdown (a defined list, not free text) — this keeps Lost-reason reporting on Sales Reports consistent across the whole team.

Lost is also terminal.`,
      },
      {
        title: "Hold and Cancel — independent of stage",
        body: `**On Hold** and **Cancelled** aren't stages — they're separate flags that can be set from any open lead, regardless of what stage it's currently at:
- **Hold** pauses a lead temporarily (requires a reason) and can be resumed later.
- **Cancel** ends a lead permanently (requires a reason) without marking it Won or Lost.

A cancelled or held lead still shows its underlying stage — the flag is layered on top, not a replacement for it.`,
      },
    ],
  },

  {
    id: "po-sap-matching",
    label: "PO Number & SAP Order Matching",
    icon: LinkIcon,
    description:
      "How the PO number you type at Won automatically connects your lead to the real SAP sales order — and what to do while you're waiting for that to happen.",
    steps: [
      {
        title: "Why the PO Number matters",
        body: `The **PO Number** you type when marking a lead Won is the *only* thing connecting your CRM lead to the real order in SAP. There's no other link — no dropdown, no manual selection — it's purely the exact text of the PO number, matched automatically once the order exists in SAP.

Because the match is exact text, type the PO number precisely as it will appear in SAP — extra spaces or a different format will cause it to not match.`,
      },
      {
        title: "Nothing happens in SAP automatically",
        body: `Marking a lead Won does **not** create anything in SAP. A sales admin still has to manually go into SAP B1 and create the actual Sales Order, using the PO number and details from the PO document you attached.

Until that happens, your lead sits in a "Pending SAP Order" state.`,
      },
      {
        title: `Finding what's still "Pending SAP Order"`,
        body: `Three places surface this so nothing gets missed:
- **Leads List filter** — filter by "Pending SAP Order: True" to see exactly which Won leads are still waiting.
- **Card badge** — a red "Pending SAP Order" badge appears directly on the lead's card in the List view.
- **Leads Overview KPI tile** — "Pending SAP Order Entry" shows the current backlog count, turning yellow then red as it grows. Clicking it jumps straight to the filtered list.

This is a live, current count — it always reflects right now, not just a time period you've filtered to.`,
      },
      {
        title: "Copying the PO number for SAP",
        body: `Next to the PO Number badge on a lead's card is a small copy icon — click it to copy the exact PO number to your clipboard, ready to paste into SAP when creating the order. This avoids any risk of a typo breaking the automatic match.`,
      },
      {
        title: "What happens once the order is created in SAP",
        body: `Once a sales admin creates the Sales Order in SAP with the matching PO number, it's picked up automatically the next time SAP data syncs into this portal. As soon as it lands:
- The **lead owner is notified**, both as an in-app notification and by email, letting them know the SAP sales order has been created.
- The lead's **Pending SAP Order badge/filter/KPI clears automatically** — nothing needs to be manually marked done.`,
      },
      {
        title: "Checking the match yourself, either direction",
        body: `You don't have to wait for the notification — the match is visible any time:
- On the **lead's** detail sidebar, a **"Matched SAP Sales Order"** card shows any SAP orders that match its PO number, and is clickable straight through to that order's full detail.
- On the **sales order's** detail page, a **"View Matching Lead"** button does the reverse — jump straight back to the lead that PO number belongs to.

If a PO number happens to match more than one SAP order (this can genuinely happen, e.g. a split order), the lead's card will show all of them and flag that there's more than one — worth a quick manual check in that case.`,
      },
    ],
  },

  {
    id: "sales-orders",
    label: "Sales Orders",
    icon: ReceiptIcon,
    description:
      "How to browse, search, and read the real SAP sales orders synced into this portal.",
    steps: [
      {
        title: "Sales Orders is read-only, sourced from SAP",
        body: `**Sales → Sales Orders → All Orders** shows every SAP sales order synced into this portal. SAP is the system of record for this data — you can't create, edit, or delete an order here, only view it.`,
      },
      {
        title: "Searching and filtering",
        body: `Use the search bar to find an order by SO number, customer name, or PO number. Filters let you narrow by customer, sales rep, status (Open/Closed), cancelled orders, and order date range.`,
      },
      {
        title: "Reading an order card",
        body: `Each order card shows: Open/Closed status, the customer and their SAP customer code, the PO number (if any), order and delivery dates, the order total, and gross profit. The small photo on the card is the SAP sales rep this order is attributed to, mapped through to their real employee record — hover it to see their name.`,
      },
      {
        title: "Opening an order's detail",
        body: `Click any order card to open its full detail, including every line item (item, quantity, unit price, line total). Each order's URL is shareable — you can send a direct link to a specific order.

If that order matches a lead by PO number, a **"View Matching Lead"** button appears at the top of the detail — jump straight to that lead.`,
      },
      {
        title: "Budgets tab (managers)",
        body: `The **Budgets** tab sits alongside All Orders and tracks each rep's invoice-based quota — a separate concept from the pipeline quota tracked on the Leads → Targets page. This tab is manager-only.`,
      },
    ],
  },

  {
    id: "sales-reports",
    label: "Sales Reports",
    icon: ChartBarIcon,
    description:
      "What each KPI tile on the Sales Reports dashboard actually measures.",
    steps: [
      {
        title: "Active Pipeline",
        body: `The total expected revenue of every lead that's still open — not yet Won, Lost, or Cancelled. This tile is a snapshot of what's open *right now*, not bound to whatever date range you've selected, unlike most of the other tiles.`,
      },
      {
        title: "Pipeline Generated",
        body: `The total expected revenue of leads *created* within your selected period — a top-of-funnel measure of how much new opportunity came in, regardless of whether it's since closed.`,
      },
      {
        title: "Pipeline Attainment (CRM)",
        body: `Your team's self-reported Won revenue (the **Actual Revenue** typed in at Won) against its sales quota for the period.

This is deliberately the CRM's own number, not SAP's. Sales Reports and Finance Reports separately show SAP-recognized, invoiced revenue per rep, and that number will not generally match this one — that's expected, not a bug. One is a forward-looking, self-reported forecast; the other is an audited, backward-looking figure once SAP has actually invoiced it.`,
      },
      {
        title: "Lost Revenue",
        body: `The total expected revenue of every Lost or Cancelled lead in the period, plus supporting detail: total lost deals, average lost deal size, and average time-to-lost.`,
      },
      {
        title: "Pending SAP Order Entry",
        body: `The same live backlog count from the "PO Number & SAP Order Matching" guide, surfaced here too — how many Won leads with a PO number still have no matching SAP sales order. Click through to jump straight to that filtered list on the Leads page.`,
      },
    ],
  },

  {
    id: "clients",
    label: "Clients — Prospects vs. SAP Customers",
    icon: UsersIcon,
    description:
      "The two kinds of accounts a lead can belong to, and why a lead can only ever reference one.",
    steps: [
      {
        title: "Two kinds of accounts",
        body: `Every lead's account is exactly one of two kinds — never both, and the system enforces this:
- A **Prospect** (under **Clients → Prospects**) — an account you've created natively in this portal, for a company that doesn't exist in SAP yet.
- A **real SAP Customer** (under **Clients → SAP**) — an existing customer already in SAP B1.`,
      },
      {
        title: "Prospects",
        body: `Prospects are department-shared reference accounts — name, industry, and contact details you maintain directly in this portal. Use a Prospect when you're working a lead for a company that isn't yet a real SAP customer.`,
      },
      {
        title: "SAP Customers",
        body: `The **SAP** tab is a read-only, searchable view of real SAP customer accounts, synced in from SAP just like Sales Orders. Use this when your lead is for a company that's already a customer.`,
      },
      {
        title: "Why never both",
        body: `A lead references a Prospect *or* a SAP customer, never both at once — this is enforced when you create or edit a lead's account. Once you know which one applies, that choice is what determines whether the lead shows a "Prospect" or "SAP Customer" badge on its detail sidebar.`,
      },
    ],
  },

  {
    id: "rep-mapping",
    label: "Sales Rep Mapping",
    icon: UsersThreeIcon,
    description:
      "Why SAP sales reps need to be linked to real Hyrax employees, and where that link shows up.",
    steps: [
      {
        title: "Why this exists",
        body: `SAP identifies a sales rep by its own internal salesperson code — it has no idea which Hyrax employee that actually is. **Sales Rep Mapping** links each SAP sales rep code to a real employee record in this portal, so that rep's name and photo can be shown anywhere SAP data references them (Sales Orders, Sales Reports).`,
      },
      {
        title: "Checking or setting the mapping",
        body: `**Sales → Sales Rep Mapping** (manager-only) lists every SAP sales rep, whether it's currently linked to an employee, and lets you set or change that link. New SAP reps appear here automatically the first time SAP data mentions them — you only need to link the employee, not create the row.`,
      },
      {
        title: "Where the mapping shows up",
        body: `Once mapped, that link is what powers the rep's photo and name on Sales Order cards, and the per-rep breakdowns on Sales Reports (Order Book by Rep, Gross Profit by Rep). An unmapped rep still shows up in these places, just without a name or photo attached.`,
      },
    ],
  },
];
