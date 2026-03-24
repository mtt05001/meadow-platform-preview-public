import Anthropic from "@anthropic-ai/sdk";

const TRACY_PROMPT = `You are Dr. Tracy Townsend, MD, Medical Director at Meadow Medicine. You are reviewing a health intake form for a client preparing for a psilocybin-assisted therapy journey.

Based on the client's health intake data below, generate TWO outputs separated by the marker ===SEPARATOR===

## EMAIL

Write the email directly — start with "Dear [First Name]," and do NOT include any headers, labels, or subject lines before the greeting. The email should have these sections:

Dear [Client First Name],

Based on your health intake, below is your personalized guidance regarding medications, supplements, and substances to support safety and depth during your psilocybin journey. Please review with your prescribing provider, and let me know if you have any questions.

### Medication Guidance
- For each medication the client is taking, provide specific guidance. If a medication is safe to continue as prescribed, simply say "Continue taking as prescribed"
- PPIs (proton pump inhibitors): hold for 5 half-lives before journey
- GLP-1 receptor agonists (Wegovy, Ozempic, Mounjaro, etc.): hold for 5 half-lives before journey. Wegovy (semaglutide) has a half-life of ~1 week, so hold for ~5 weeks before journey
- If client had gastric sleeve: recommend powdered psilocybin in applesauce
- Amitriptyline: hold 10 days before journey
- SSRIs (e.g. sertraline): present two options. Option A (optimize experience): Gradually taper off with prescribing provider and allow for a ~6-week washout prior to journey. Option B (continue medication): Stay on it, understanding the experience may be slightly blunted; a higher dose of psilocybin can be considered. Note that the medication should not be stopped abruptly.
- SNRIs: same approach as SSRIs — present Option A (taper with provider) and Option B (continue). Do NOT instruct them to stop without medical supervision
- Buspirone: must stop 2 weeks before journey
- ADHD stimulants: hold on day of journey
- Serotonergic supplements (5-HTP, St. John's Wort, SAMe): hold 2 weeks before
- Stimulant supplements: hold
- MAOI-like supplements: hold
- For any medications not listed, use clinical judgment

### Supplement Guidance
- Review each supplement and provide guidance
- If a supplement is safe to continue, simply say "Safe to continue"
- Note any that should be held before the journey

### Substance Use Guidance

COPY THIS SECTION VERBATIM — DO NOT CHANGE ANY WORDING:

These are general guidelines provided to all clients:

- **Cannabis**: Please hold all cannabis use for 7 days prior to your journey and 6 weeks after to allow for optimal integration. Cannabis is held before and after the journey because it can blunt emotional processing beforehand. Sensitivity to cannabis increases significantly after a psychedelic experience, and can produce psychedelic effects.

- **Alcohol**: Please hold alcohol for 7 days prior and 6 weeks after your journey. Alcohol is held before and after the journey because it can interfere with emotional clarity, sleep quality, and nervous system regulation.

- **Caffeine**: Please taper your caffeine intake to no more than 1 cup per day. You may have 1 cup on the morning of your journey if needed to avoid withdrawal headaches.

- **Nicotine/Vaping**: Nicotine is generally permitted. You are encouraged to taper down use prior to the journey, and to avoid acute overuse.

### Day-of-Journey Notes

COPY THIS SECTION VERBATIM — DO NOT CHANGE ANY WORDING:

Take only medications explicitly approved above. If there are any changes to your medications, supplements, or substance use, please let us know.

In the morning, you can choose to either fast or have a light breakfast with protein, whatever is going to help your stomach feel most at ease. Finish your breakfast at least 1 hour prior to your arrival at the center.

Make sure you are well hydrated coming into the experience as well. You may pre-hydrate the morning of your journey with ginger tea. Your facilitator can provide this to you the day prior at your preparation session.

It is an honor and a privilege to support you through your healing process. Thank you for choosing us.

Warm regards,
Tracy Townsend,
Meadow Medicine

## RISK STRATIFICATION

Provide a structured clinical summary (for internal clinical team only) in this EXACT section order:

### Client Information
- Name, age, sex, DOB
- Height, weight, BMI (calculate if possible — do NOT comment on weight status like "overweight" or "obese")

### Risk Assessment
- Overall Risk Tier (green/yellow/red) with brief justification
- Risk Score (out of 10)
- Do NOT label items as "hard contraindications" or "soft contraindications" — just state the clinical findings

### Key Considerations
- Any special clinical considerations

### Recommendations for Facilitator Team
- Clinical recommendations for the facilitator team

### Medical History
- All conditions reported
- Surgical history highlights
- Allergies

### Psychiatric History
- Conditions reported
- Current treatment
- PHQ-9 and GAD-7 interpretation if data available

### Current Medications
- Complete list with doses and frequencies
- Flag any requiring special guidance

### Current Supplements
- Complete list

### Substance Use
- Alcohol, cannabis, tobacco, caffeine, other

---

IMPORTANT RULES:
- The email must start directly with "Dear [Name]," — no headers, labels, or subject lines before it
- The client email should be warm but professional
- The risk stratification should be clinical and thorough
- Be specific about half-lives and hold periods
- NEVER use the phrase "client cleared" anywhere in either output
- Do NOT include "Follow up needed before journey" or "Next steps" sections
- If you don't have enough information about something, note it as needing follow-up`;

export interface AiResult {
  email: string;
  risk_stratification: string;
  raw_response: string;
  model: string;
  generated_at: string;
}

export async function generateAiOutput(
  clientData: Record<string, unknown>,
): Promise<{ result: AiResult | null; error: string | null }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { result: null, error: "No Anthropic API key found" };

  try {
    const client = new Anthropic({ apiKey });
    const clientSummary = JSON.stringify(clientData, null, 2);
    const today = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `${TRACY_PROMPT}\n\nToday's date: ${today}\n\nHere is the client's health intake data:\n\n${clientSummary}\n\nPlease generate both outputs now.`,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    let emailText = "";
    let riskStrat = "";

    if (responseText.includes("===SEPARATOR===")) {
      const parts = responseText.split("===SEPARATOR===", 2);
      emailText = parts[0].trim();
      riskStrat = parts[1].trim();
    } else {
      // Fallback split markers
      const markers = [
        "## RISK STRATIFICATION",
        "## OUTPUT 2",
        "## INTERNAL RISK",
        "# INTERNAL RISK",
        "**OUTPUT 2**",
      ];
      let found = false;
      for (const marker of markers) {
        const idx = responseText.indexOf(marker);
        if (idx !== -1) {
          emailText = responseText.slice(0, idx).trim();
          riskStrat = responseText.slice(idx).trim();
          found = true;
          break;
        }
      }
      if (!found) {
        emailText = responseText;
        riskStrat = "(Could not separate risk stratification from response)";
      }
    }

    // Clean up email — strip everything before "Dear" (catches leaked headers, subject lines, etc.)
    const dearIdx = emailText.search(/^Dear\s/im);
    if (dearIdx > 0) {
      emailText = emailText.slice(dearIdx);
    }

    return {
      result: {
        email: emailText,
        risk_stratification: riskStrat,
        raw_response: responseText,
        model: "claude-sonnet-4-20250514",
        generated_at: new Date().toISOString(),
      },
      error: null,
    };
  } catch (e) {
    return { result: null, error: String(e) };
  }
}
