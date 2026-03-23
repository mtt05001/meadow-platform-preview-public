# Analytics Dashboard — What You're Looking At

## Top Row: Key Numbers

| Metric | What it means | Where the data comes from |
|---|---|---|
| **Total Intakes** | How many health intake forms have been submitted, ever | Jotform submissions synced into our database |
| **Pending Review** | Intakes waiting for someone to review and approve | Intakes that haven't been approved or archived yet |
| **Approval Rate** | Percentage of all intakes that have been approved | Approved intakes ÷ total intakes |
| **Avg Turnaround** | Average time between a submission arriving and being approved | Time from intake creation to approval |

## Risk Tier Distribution

Shows how many intakes fall into each risk category (excluding archived):

- **Green** — No concerning flags. Standard preparation.
- **Yellow** — Some flags worth noting. May need extra attention during prep.
- **Red** — Hard contraindications found (specific medications or conditions), or high soft score. Requires clinical review.
- **Unknown** — Not yet processed or missing data.

These tiers are assigned automatically by the risk engine based on the client's health intake answers — they are not subjective. The engine scans for ~100 medical conditions and ~130 medications.

## Intake Volume

Monthly bar chart showing how many new intakes arrived each month over the past year. Useful for spotting trends in patient flow.

## Client Pipeline

Shows where all active clients are in their journey — from onboarding through integration. This data comes from GoHighLevel (the CRM). Each client sits in a pipeline stage:

- **Onboarding** — New clients getting set up
- **Prep** — Preparing for their session (Prep 1, Prep 2)
- **Journey** — In their psilocybin session window
- **Integration** — Post-session integration meetings
- **Complete** — Finished their program

The stacked bar at the top gives a quick visual of the overall distribution. The individual bars below break it down by specific stage.

## Upcoming Sessions

Lists all scheduled sessions (Prep 1, Prep 2, Journey, Integration 1, Integration 2) in the next 14 days. Dates come from GoHighLevel calendar fields. If a session is missing here, it likely hasn't been scheduled in GHL yet.

## Top Contraindications

The most common medical flags found across active intakes. These are the specific conditions or medications that the risk engine flagged during processing. Useful for understanding the typical risk profile of the patient population.

## Facilitator Workload

How many active clients each facilitator currently has assigned. This comes from the Lead Facilitator field in GoHighLevel. "Unassigned" means no facilitator has been set yet.

---

**Data freshness:** Intake data updates in real-time as forms are processed. Client pipeline data updates when someone triggers a sync from the Clients page (pulls latest from GoHighLevel).
