// Scenarios, phases 3-6: the rest of finance, healthcare, consumer & retail, and professional
// services. Same shape as api/scenarios.js, kept in a second file only so neither is unreadable.
//
// ── WHAT MAKES ONE OF THESE WORK ──────────────────────────────────────────────────────
// Every `decide` step has no free option. The obvious choice costs something, the careful
// choice costs something else, and what is being read is whether the student can name the
// trade they made. A scenario where one option is plainly correct tests reading comprehension.
//
// `reveals` is written when the scenario is designed, not improvised while reading a
// transcript — that is what stops two raters inventing two different standards for the same
// answer. `defense` is the question a practitioner would actually ask next.
//
// ── HEALTHCARE ────────────────────────────────────────────────────────────────────────
// Every clinical scenario is synthetic by construction and says so in the brief. No student is
// ever asked to bring, upload, or describe real patient data. The judgement being tested is
// about process and evidence, and none of it requires a real record.

// ── Finance ───────────────────────────────────────────────────────────────────────────

export const LBO = {
  id: 'pe-diligence-1',
  specialization: 'private-equity',
  title: 'The add-on that carries the thesis',
  minutes: 40,
  skills: ['LBO structure', 'diligence judgement', 'assumption defence'],
  brief: 'You are on a deal team looking at a regional services roll-up. The base case clears the hurdle only if two add-on acquisitions close in year one.',
  steps: [
    {
      id: 'model', kind: 'reveal', next: 'where',
      title: 'The model you inherited',
      body: 'An associate who has since left built the LBO. Returns come in at 22% IRR. The synergy line for the two add-ons is a single hardcoded figure with no build behind it, and it is worth about six points of that IRR.',
    },
    {
      id: 'where', kind: 'decide', title: 'The IC memo is due in two days. Where do you spend the first?',
      options: [
        { id: 'synergy', label: 'Rebuild the synergy line from the bottom up', next: 'seller',
          reveals: 'Goes at the assumption carrying the thesis. Six points of IRR resting on a hardcode is the whole question, and rebuilding it is the only way to know whether the deal clears.',
          defense: 'You rebuilt the synergies. What did you find that the hardcode was hiding, and did the deal still clear?' },
        { id: 'debt', label: 'Pressure-test the debt schedule and covenants', next: 'seller',
          reveals: 'Goes at downside protection first. Reasonable in a levered deal, but it tests survival rather than whether the return case is real.',
          defense: 'You tested the capital structure before the return driver. If the synergies are half what is modelled, does the covenant work still matter?' },
        { id: 'market', label: 'Size the market and validate the roll-up logic', next: 'seller',
          reveals: 'Goes to the strategic question. Useful, and it is the piece most likely to be already covered by the banker materials in front of you.',
          defense: 'You went to market sizing. What did that tell you that the CIM did not already claim?' },
      ],
    },
    {
      id: 'seller', kind: 'reveal', next: 'ic',
      title: 'The seller adds a condition',
      body: 'The seller will not let you contact either add-on target before signing. Both are owner-operated, and the owners do not know a sale process is running.',
    },
    {
      id: 'ic', kind: 'decide', title: 'How does the memo handle it?',
      options: [
        { id: 'range', label: 'Present a range with the no-add-on case as the floor', next: 'produce',
          reveals: 'Prices the uncertainty rather than resolving it. The IC sees what happens if the thesis does not land.',
          defense: 'Your floor case assumes no add-ons close. Would you still do the deal at that number?' },
        { id: 'condition', label: 'Recommend proceeding, conditional on post-signing diligence', next: 'produce',
          reveals: 'Keeps the deal alive and moves the risk past the point of committing. Common, and it means the protection has to come from the documents rather than the analysis.',
          defense: 'You pushed the risk past signing. What specifically in the SPA carries it, and who negotiates that?' },
        { id: 'pass', label: 'Recommend passing until the targets can be contacted', next: 'produce',
          reveals: 'Refuses to underwrite what cannot be checked. Defensible and it loses deals that competitors will do.',
          defense: 'You recommended passing. If a competing fund signs this on the same information, what did they see that you did not?' },
      ],
    },
    {
      id: 'produce', kind: 'produce', next: 'defend',
      title: 'The recommendation',
      body: 'Write the recommendation paragraph you would put at the top of the IC memo, including the one assumption you would most want challenged.',
    },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

export const PIPELINE = {
  id: 'vc-pipeline-1',
  specialization: 'venture-capital',
  title: 'The founder who will not share the metric',
  minutes: 35,
  skills: ['founder diligence', 'reference-taking', 'writing a memo that commits'],
  brief: 'You are an analyst at a seed fund. A founder you sourced is raising, moving fast, and has a term sheet from another firm expiring Friday.',
  steps: [
    {
      id: 'deck', kind: 'reveal', next: 'ask',
      title: 'What you have',
      body: 'A deck showing 40% month-on-month growth for six months, two named design partners, and a team of three. Revenue is described as "annualised run rate" with no cohort or retention data anywhere.',
    },
    {
      id: 'ask', kind: 'decide', title: 'The founder says retention data is "not clean enough to share yet"',
      options: [
        { id: 'push', label: 'Say you cannot recommend it without cohort retention', next: 'reference',
          reveals: 'Holds the line on the one number that separates growth from churn-and-replace. Costs speed, and sometimes the deal.',
          defense: 'You held the line and the term sheet expires Friday. What would have changed your mind short of getting the data?' },
        { id: 'proxy', label: 'Ask the design partners directly about usage instead', next: 'reference',
          reveals: 'Routes around the founder to the underlying truth. Gets a real signal, and it uses up goodwill and tips the founder that you are checking.',
          defense: 'You went to the customers rather than the founder. How did you tell the founder you were doing it, and what did that cost you?' },
        { id: 'proceed', label: 'Underwrite on growth and team, and flag retention as the open risk', next: 'reference',
          reveals: 'Accepts an incomplete picture at seed, where incomplete is normal. The risk is that the missing number is missing for a reason.',
          defense: 'You underwrote without the number. What is the specific thing you are betting is not true?' },
      ],
    },
    {
      id: 'reference', kind: 'reveal', next: 'call',
      title: 'A reference call goes sideways',
      body: 'A former colleague of the founder, offered as a reference, is warm about their ability and notably careful about a previous co-founder split. They will not say more on the record.',
    },
    {
      id: 'call', kind: 'decide', title: 'What do you do with a soft negative you cannot substantiate?',
      options: [
        { id: 'founder', label: 'Take it to the founder directly and ask them to explain it', next: 'produce',
          reveals: 'Gives the person a chance to answer the thing that could sink them. Also risks burning the reference who spoke carefully for a reason.',
          defense: 'You took it back to the founder. How did you protect the reference while still asking the question?' },
        { id: 'more-refs', label: 'Take two more off-list references before deciding', next: 'produce',
          reveals: 'Tries to establish whether it is a pattern or one bad ending. Costs the days you do not have.',
          defense: 'You went looking for a pattern with a Friday deadline. What would two more calls have had to say to change your answer?' },
        { id: 'note', label: 'Record it in the memo without acting on it', next: 'produce',
          reveals: 'Preserves the signal for whoever reads the file later without letting an unsubstantiated remark drive the decision.',
          defense: 'You wrote it down and moved on. If this becomes the reason the investment fails, does that note read as diligence or as a warning you ignored?' },
      ],
    },
    {
      id: 'produce', kind: 'produce', next: 'defend',
      title: 'The memo',
      body: 'Write the investment recommendation in under 200 words. State what you believe, what would make you wrong, and what you would need to see in 90 days.',
    },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

export const MANDATE = {
  id: 'awm-drawdown-1',
  specialization: 'asset-wealth-management',
  title: 'The client who wants out at the bottom',
  minutes: 35,
  skills: ['portfolio construction', 'client judgement', 'explaining risk under stress'],
  brief: 'You support an adviser on a discretionary book. A long-standing client is down 18% year to date against a mandate that allows it.',
  steps: [
    {
      id: 'call', kind: 'reveal', next: 'first',
      title: 'The call',
      body: 'The client wants everything moved to cash today. Their stated horizon is eleven years and their mandate was set to tolerate a 25% drawdown. Nothing about their circumstances has changed.',
    },
    {
      id: 'first', kind: 'decide', title: 'What do you prepare for the adviser before the call back?',
      options: [
        { id: 'history', label: 'The drawdown in the context of the mandate they signed', next: 'concentration',
          reveals: 'Anchors the conversation on the agreement rather than the last quarter. Correct in substance, and it can read as being told your own feelings are wrong.',
          defense: 'You led with the mandate. How do you say that to somebody frightened without it sounding like a refusal?' },
        { id: 'cost', label: 'The cost of realising the loss and re-entering later', next: 'concentration',
          reveals: 'Makes the decision concrete and personal. It is also an argument that stops working if markets keep falling.',
          defense: 'You quantified the cost of selling. What is your answer if they ask what happens when it drops another ten percent?' },
        { id: 'partial', label: 'A partial de-risking option that keeps them invested', next: 'concentration',
          reveals: 'Finds a decision the client can actually live with. Compromises the mandate slightly to protect the client from an irreversible choice.',
          defense: 'You offered a middle path. Is that serving the client, or is it managing them?' },
      ],
    },
    {
      id: 'concentration', kind: 'reveal', next: 'disclose',
      title: 'You notice something else',
      body: 'Reviewing the account, 31% of the portfolio sits in one sector. The mandate caps sector concentration at 25%. It has been over since a rebalance four months ago and nobody flagged it.',
    },
    {
      id: 'disclose', kind: 'decide', title: 'The client has not asked about it',
      options: [
        { id: 'now', label: 'Raise the breach on this call, alongside the drawdown', next: 'produce',
          reveals: 'Discloses at the first opportunity even though the timing is terrible. The client learns their portfolio was out of line while they are already losing trust.',
          defense: 'You disclosed during the worst possible call. What did that do to the conversation you were trying to have?' },
        { id: 'fix-first', label: 'Escalate internally, correct it, then disclose with the fix', next: 'produce',
          reveals: 'Arrives with a problem and a solution together. The delay is real and the client was in breach without knowing during it.',
          defense: 'You fixed before telling. How long was the gap, and who decided that was acceptable?' },
        { id: 'separate', label: 'Handle the call, then disclose in writing the same day', next: 'produce',
          reveals: 'Separates two conversations that would damage each other, without letting the disclosure slip.',
          defense: 'You split them apart. What stops "later today" from becoming "next week" the next time this happens?' },
      ],
    },
    {
      id: 'produce', kind: 'produce', next: 'defend',
      title: 'The note',
      body: 'Write what you would send the adviser before the call: your recommendation on the drawdown, and how you would handle the breach.',
    },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

export const LEDGER = {
  id: 'audit-cutoff-1',
  specialization: 'accounting-audit',
  title: 'The revenue that arrived early',
  minutes: 35,
  skills: ['cut-off testing', 'professional scepticism', 'escalation judgement'],
  brief: 'You are on a first-year audit of a mid-sized software business. You are testing revenue recognition around the year-end cut-off.',
  steps: [
    {
      id: 'sample', kind: 'reveal', next: 'test',
      title: 'Your sample',
      body: 'Of 40 contracts sampled around year end, four were recognised in full in December. Their signed dates are December 29th, 30th and 31st. Two have delivery milestones starting in February.',
    },
    {
      id: 'test', kind: 'decide', title: 'How do you test it?',
      options: [
        { id: 'expand', label: 'Expand the sample across the whole final quarter', next: 'client',
          reveals: 'Establishes whether four contracts are a pattern or the tail of a normal December. Costs budget, and it is the only way to know the size of the problem.',
          defense: 'You expanded the sample. What would the result have had to be for you to conclude this was normal seasonality?' },
        { id: 'contracts', label: 'Read the four contracts in full against the revenue policy', next: 'client',
          reveals: 'Goes deep before going wide. Establishes whether these four are actually wrong, which the sample expansion assumes.',
          defense: 'You read the four first. If all four turned out to be correctly recognised, would you still have expanded?' },
        { id: 'ask', label: 'Ask the controller to walk you through the December close', next: 'client',
          reveals: 'Fastest route to understanding, and it takes an explanation from the person with the most reason to give a comfortable one.',
          defense: 'You asked the controller first. How did you corroborate what they told you?' },
      ],
    },
    {
      id: 'client', kind: 'reveal', next: 'escalate',
      title: 'The explanation',
      body: 'The controller says the contracts have no delivery obligation attached and revenue is correctly recognised on signature. The engagement partner mentions in passing that this client is up for a large advisory mandate next quarter.',
    },
    {
      id: 'escalate', kind: 'decide', title: 'What do you do with that second sentence?',
      options: [
        { id: 'ignore', label: 'Treat it as irrelevant and finish the testing on its merits', next: 'produce',
          reveals: 'Refuses to let a commercial fact bend the work. Clean, and it means nobody else ever knows the pressure existed.',
          defense: 'You set it aside. If your conclusion had gone the client\'s way, how would anyone reading the file know it was not influenced?' },
        { id: 'document', label: 'Complete the testing and document the remark in the working papers', next: 'produce',
          reveals: 'Puts the pressure on the record where it can be reviewed, without letting it change the conclusion.',
          defense: 'You wrote down what the partner said. What happens to your review relationship after that?' },
        { id: 'manager', label: 'Raise it with the audit manager before concluding', next: 'produce',
          reveals: 'Uses the escalation path that exists for exactly this. Slower, and the right answer if the pressure is real.',
          defense: 'You escalated to the manager. What would you have done if the manager told you to drop it?' },
      ],
    },
    {
      id: 'produce', kind: 'produce', next: 'defend',
      title: 'The working paper conclusion',
      body: 'Write the conclusion paragraph for this test: what you did, what you found, and what you are relying on.',
    },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

// ── Healthcare operations ─────────────────────────────────────────────────────────────
// All synthetic. No student is asked for real patient data at any point.

export const CLINIC = {
  id: 'clinops-backlog-1',
  specialization: 'clinical-operations',
  title: 'The clinic running ninety minutes late',
  minutes: 35,
  skills: ['process mapping', 'operational triage', 'working with clinical staff'],
  brief: 'A synthetic scenario. You are an operations associate at a multi-site outpatient clinic. No real patient information appears anywhere in this exercise.',
  steps: [
    {
      id: 'floor', kind: 'reveal', next: 'first',
      title: 'What you observe',
      body: 'One site runs 90 minutes behind by mid-afternoon, every day. Intake takes 12 minutes against a 6-minute standard. Two of four exam rooms sit empty for long stretches. Staff say the schedule is the problem; the schedule matches the other three sites exactly.',
    },
    {
      id: 'first', kind: 'decide', title: 'Where do you look first?',
      options: [
        { id: 'intake', label: 'Time and map the intake process step by step', next: 'nurse',
          reveals: 'Goes at the measured deviation. Intake is double standard and it is the one number that differs from the sites that work.',
          defense: 'You mapped intake. What did you find in those extra six minutes?' },
        { id: 'rooms', label: 'Work out why rooms sit empty while people wait', next: 'nurse',
          reveals: 'Goes at the visible contradiction. Idle capacity beside a queue usually means the constraint is upstream, which points back at intake anyway.',
          defense: 'You started with the empty rooms. Where did that lead you?' },
        { id: 'staff', label: 'Interview the staff about what actually slows them down', next: 'nurse',
          reveals: 'Goes to the people doing the work, who usually know. Also collects the explanation they have already settled on, which is the schedule.',
          defense: 'Staff told you it was the schedule and the data says it is not. How did you handle that?' },
      ],
    },
    {
      id: 'nurse', kind: 'reveal', next: 'change',
      title: 'What you find',
      body: 'Intake staff re-enter demographic data by hand because the referral system does not populate it. They also catch roughly one wrong-record error a week doing it. Nobody has ever logged those catches.',
    },
    {
      id: 'change', kind: 'decide', title: 'The obvious fix is to automate the transfer',
      options: [
        { id: 'automate', label: 'Recommend automating it and removing the manual step', next: 'produce',
          reveals: 'Takes out six minutes per patient. It also removes the only place where a wrong record is currently caught, and that catch is unlogged so it will not appear in anyone\'s risk assessment.',
          defense: 'The manual step was catching a wrong record a week. What replaces that after you automate it?' },
        { id: 'automate-check', label: 'Automate the transfer and add an explicit verification step', next: 'produce',
          reveals: 'Keeps the safety function while removing most of the cost. Slower to build and it has to be designed with clinical staff rather than for them.',
          defense: 'You kept a check in place. How long does it add back, and who agreed that number?' },
        { id: 'measure', label: 'Log the catches for a month before changing anything', next: 'produce',
          reveals: 'Refuses to trade away a safety function that has never been measured. Costs a month of a 90-minute daily delay.',
          defense: 'You waited a month to measure. Who bore the cost of that delay while you did?' },
      ],
    },
    {
      id: 'produce', kind: 'produce', next: 'defend',
      title: 'The recommendation',
      body: 'Write what you would take to the clinic manager: the change, what it saves, and what it puts at risk.',
    },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

export const COHORT = {
  id: 'healthdata-readmit-1',
  specialization: 'health-analytics',
  title: 'The readmission model that looks too good',
  minutes: 40,
  skills: ['cohort definition', 'leakage detection', 'communicating a caveat'],
  brief: 'A synthetic dataset built for this exercise. You are asked to review a readmission risk model before it goes in front of a clinical committee.',
  steps: [
    {
      id: 'metrics', kind: 'reveal', next: 'check',
      title: 'The model you are reviewing',
      body: 'Thirty-day readmission prediction. AUC 0.94 on held-out data, which is far above what this problem usually achieves. The feature list includes discharge disposition, length of stay, and a field called `care_plan_flag`.',
    },
    {
      id: 'check', kind: 'decide', title: 'What do you check first?',
      options: [
        { id: 'features', label: 'Trace when each feature becomes known relative to discharge', next: 'source',
          reveals: 'Goes straight at leakage. An AUC that far above the literature is usually a feature that encodes the outcome, and timing is how you find it.',
          defense: 'You checked feature timing. Which feature was not available at prediction time?' },
        { id: 'split', label: 'Check how the train and test split was constructed', next: 'source',
          reveals: 'Goes at the other common cause. Patients appearing in both splits inflates the number the same way.',
          defense: 'You checked the split. Was it by patient or by admission, and why does that matter here?' },
        { id: 'baseline', label: 'Compare against a simple baseline on the same data', next: 'source',
          reveals: 'Establishes how much of the number is the model and how much is the data. Fast, and it diagnoses rather than explains.',
          defense: 'Your baseline also scored high. What did that tell you?' },
      ],
    },
    {
      id: 'source', kind: 'reveal', next: 'committee',
      title: 'What `care_plan_flag` is',
      body: 'It is set when a discharge planner opens a follow-up care plan. Planners open one when they expect the patient to come back. It is recorded at discharge, so it passes every timing check that looks only at dates.',
    },
    {
      id: 'committee', kind: 'decide', title: 'The committee meets in three days and the model was expected to be approved',
      options: [
        { id: 'kill', label: 'Recommend the model is not deployed until it is rebuilt', next: 'produce',
          reveals: 'Refuses to ship a model whose headline number comes from a human already knowing the answer. Costs the timeline and the goodwill attached to it.',
          defense: 'You blocked it three days out. What did you say to the team who built it?' },
        { id: 'retrain', label: 'Drop the feature, retrain, and present the honest number', next: 'produce',
          reveals: 'Fixes it rather than killing it. The AUC will fall a long way and the committee has to be told why the number changed.',
          defense: 'The number dropped from 0.94 to something much lower. How did you present that without it reading as failure?' },
        { id: 'caveat', label: 'Present as planned with the leakage documented as a limitation', next: 'produce',
          reveals: 'Discloses rather than resolves. A committee reading 0.94 will remember the number, not the footnote.',
          defense: 'You put it in the limitations. What is the chance the committee approved on the headline number anyway?' },
      ],
    },
    {
      id: 'produce', kind: 'produce', next: 'defend',
      title: 'The finding',
      body: 'Write the paragraph you would put at the top of the review, in language a clinician who does not build models can act on.',
    },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

export const CLAIMS = {
  id: 'revcycle-denials-1',
  specialization: 'revenue-cycle',
  title: 'The denial rate nobody owns',
  minutes: 35,
  skills: ['denial analysis', 'root-cause tracing', 'cross-team escalation'],
  brief: 'A synthetic scenario using fabricated claim data. You are analysing a rise in claim denials at a specialty practice.',
  steps: [
    {
      id: 'numbers', kind: 'reveal', next: 'trace',
      title: 'The trend',
      body: 'Denials rose from 6% to 14% over four months. Billing says coding is wrong. Coding says the front desk is capturing bad insurance information. The front desk says nothing changed. Denials cluster in one payer and one procedure group.',
    },
    {
      id: 'trace', kind: 'decide', title: 'Three teams each blame another. Where do you start?',
      options: [
        { id: 'codes', label: 'Pull the denial reason codes and group them', next: 'policy',
          reveals: 'Starts with what the payer actually said rather than what anyone internally believes. The codes are the only account nobody in the building wrote.',
          defense: 'The reason codes pointed somewhere. Did they match any of the three stories you were told?' },
        { id: 'timeline', label: 'Line the increase up against every process change in that window', next: 'policy',
          reveals: 'Looks for what changed, since the rate did. Good instinct, and it finds nothing if the change was on the payer\'s side.',
          defense: 'You looked for an internal change and the timing pointed outside. How long did that take?' },
        { id: 'shadow', label: 'Sit with the front desk and watch intake happen', next: 'policy',
          reveals: 'Goes to the accused step directly. Generates real detail, and it spends a day on the team with the least evidence against it.',
          defense: 'You spent the day at the front desk. Was that where the problem was?' },
      ],
    },
    {
      id: 'policy', kind: 'reveal', next: 'fix',
      title: 'What the codes say',
      body: 'The denials are almost all prior-authorisation related, on one payer, for a procedure group that did not require prior auth until that payer changed policy in the same month. Nobody was notified; the change was published in a bulletin.',
    },
    {
      id: 'fix', kind: 'decide', title: 'The immediate fix is obvious. What do you do about the next one?',
      options: [
        { id: 'appeal', label: 'Focus on appealing the backlog of denied claims first', next: 'produce',
          reveals: 'Recovers money already lost, which is the largest single number available. Leaves the mechanism that caused it untouched.',
          defense: 'You went after the backlog. What stops the same thing happening with a different payer next quarter?' },
        { id: 'monitor', label: 'Build a payer-bulletin monitoring process and assign it an owner', next: 'produce',
          reveals: 'Fixes the mechanism. Slower to pay off, and it creates recurring work somebody has to actually do every week.',
          defense: 'You created a standing task. Who does it when that person is on leave?' },
        { id: 'both', label: 'Appeal the backlog and hand the monitoring to the payer-relations lead', next: 'produce',
          reveals: 'Does both by putting the ongoing piece where the relationship already lives, rather than inventing a new process.',
          defense: 'You gave the monitoring to payer relations. Did you ask them, or did you assign it?' },
      ],
    },
    {
      id: 'produce', kind: 'produce', next: 'defend',
      title: 'The write-up',
      body: 'Write the summary you would send the practice manager: the cause, the recovery, and the prevention.',
    },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

export const DEVIATION = {
  id: 'regquality-capa-1',
  specialization: 'regulatory-quality',
  title: 'The deviation that keeps recurring',
  minutes: 35,
  skills: ['root-cause analysis', 'CAPA writing', 'documentation under scrutiny'],
  brief: 'A synthetic quality scenario. You support a quality team at a medical device manufacturer. No real records are used.',
  steps: [
    {
      id: 'log', kind: 'reveal', next: 'root',
      title: 'The deviation log',
      body: 'The same labelling deviation has been raised five times in fourteen months. Each time the CAPA was "operator retrained" and each time it was closed as effective. The fifth occurrence was found by a customer.',
    },
    {
      id: 'root', kind: 'decide', title: 'What does five identical CAPAs tell you?',
      options: [
        { id: 'human', label: 'That retraining was never the root cause', next: 'pressure',
          reveals: 'Reads the pattern correctly. A cause that recurs after five corrections was not the cause, and "operator error" is the most common place investigations stop early.',
          defense: 'You rejected the stated root cause. What did you replace it with, and how did you evidence it?' },
        { id: 'effective', label: 'That effectiveness checks were not real checks', next: 'pressure',
          reveals: 'Goes at the closure rather than the cause. If a CAPA can be closed as effective five times while the problem persists, the closure step is broken too.',
          defense: 'You went at the effectiveness check. What would a real one have looked like here?' },
        { id: 'trend', label: 'That trending was not happening across deviations', next: 'pressure',
          reveals: 'Goes at the system that should have caught it at occurrence two. Correct, and it is the finding an auditor will reach independently.',
          defense: 'Trending should have caught this at the second occurrence. Why do you think it did not?' },
      ],
    },
    {
      id: 'pressure', kind: 'reveal', next: 'write',
      title: 'The context you are given',
      body: 'An audit is scheduled in six weeks. Your manager asks whether reopening five closed CAPAs "creates a finding that would not otherwise exist".',
    },
    {
      id: 'write', kind: 'decide', title: 'How do you answer that?',
      options: [
        { id: 'reopen', label: 'Reopen them and document the systemic finding fully', next: 'produce',
          reveals: 'Creates the record that the problem was found and addressed before an auditor found it. It also guarantees the auditor sees five failed CAPAs.',
          defense: 'You created the paper trail that shows five failures. Why is that better than an auditor finding it cold?' },
        { id: 'new', label: 'Raise one new systemic CAPA that supersedes the five', next: 'produce',
          reveals: 'Addresses the real cause without reopening closed records. Cleaner, and whether it is legitimate depends entirely on the quality system\'s own rules.',
          defense: 'You superseded rather than reopened. Does your quality system actually permit that, or is it just tidier?' },
        { id: 'escalate', label: 'Escalate to the quality head, in writing, before deciding', next: 'produce',
          reveals: 'Refuses to make an audit-exposure decision at your level, and puts the question on the record. Slow, and it protects both the product and the person asking.',
          defense: 'You escalated in writing. What did putting it in writing do that a conversation would not?' },
      ],
    },
    {
      id: 'produce', kind: 'produce', next: 'defend',
      title: 'The CAPA',
      body: 'Write the root cause statement and the corrective action you would actually file.',
    },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

export const ONBOARD = {
  id: 'dhproduct-consent-1',
  specialization: 'digital-health-product',
  title: 'The onboarding step that loses half the users',
  minutes: 35,
  skills: ['product judgement', 'consent design', 'balancing conversion against comprehension'],
  brief: 'A synthetic product scenario. You work on a patient-facing app. No real user data is used in this exercise.',
  steps: [
    {
      id: 'funnel', kind: 'reveal', next: 'first',
      title: 'The funnel',
      body: 'Onboarding has six steps. Step four is a consent screen covering how health data is shared with the user\'s care team. 51% of users drop at step four. Median time on that screen is 4 seconds.',
    },
    {
      id: 'first', kind: 'decide', title: 'Four seconds on a consent screen. What is your read?',
      options: [
        { id: 'friction', label: 'It is too long and needs to be shorter and clearer', next: 'legal',
          reveals: 'Treats it as a comprehension problem. Four seconds means nobody is reading it, and a shorter screen at least has a chance of being read.',
          defense: 'You shortened it. How do you know the new version is understood rather than just skipped faster?' },
        { id: 'placement', label: 'It is in the wrong place and should come after first value', next: 'legal',
          reveals: 'Treats it as a sequencing problem. Moving it lifts conversion, and it means users share data before they understand why.',
          defense: 'You moved consent later. Is the user better informed at the new point, or just more invested?' },
        { id: 'split', label: 'It is doing too much and should be split by what is being consented to', next: 'legal',
          reveals: 'Separates a bundled consent into decisions a person can actually make. More screens, better decisions, and worse conversion.',
          defense: 'You added steps to a funnel already losing half its users. How did you justify that?' },
      ],
    },
    {
      id: 'legal', kind: 'reveal', next: 'ship',
      title: 'What you learn',
      body: 'Legal confirms the current screen is compliant as written and any change needs review. A growth target for the quarter depends on onboarding completion. The care-team sharing this consent covers is the feature clinicians say makes the app useful at all.',
    },
    {
      id: 'ship', kind: 'decide', title: 'Compliant, unread, and load-bearing. What do you ship?',
      options: [
        { id: 'test', label: 'Run a comprehension test before changing anything', next: 'produce',
          reveals: 'Establishes whether users understand what they agreed to, which nobody currently knows. Costs weeks against a quarterly target.',
          defense: 'You tested comprehension first. What result would have made you leave the screen alone?' },
        { id: 'ship-short', label: 'Ship the shorter version through legal review and measure both', next: 'produce',
          reveals: 'Moves while measuring. Balanced, and it means the first cohort on the new screen is the experiment.',
          defense: 'Your first users on the new screen were the test. Was that a fair thing to do to them?' },
        { id: 'hold', label: 'Hold the change and raise that compliant is not the same as informed', next: 'produce',
          reveals: 'Names the actual problem, which is that legal sign-off has been standing in for user understanding. Unpopular in a quarter with a target.',
          defense: 'You told the room the bar was wrong. What did you propose putting in its place?' },
      ],
    },
    {
      id: 'produce', kind: 'produce', next: 'defend',
      title: 'The proposal',
      body: 'Write what you would put in front of the product lead: the change, the risk to the target, and the risk of not changing it.',
    },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

// ── Consumer & retail ─────────────────────────────────────────────────────────────────

export const CHANNEL = {
  id: 'growth-attribution-1',
  specialization: 'growth-performance',
  title: 'The channel that stopped working overnight',
  minutes: 35,
  skills: ['attribution reasoning', 'experiment design', 'spending judgement'],
  brief: 'You run paid acquisition analysis at a consumer subscription business. Monday morning, reported CAC on your largest channel doubles.',
  steps: [
    {
      id: 'drop', kind: 'reveal', next: 'first',
      title: 'What the dashboard says',
      body: 'Paid social CAC went from $42 to $88 between Friday and Monday. Spend is flat. Impressions and click-through are unchanged. Reported conversions fell by half. Organic signups rose by roughly the same number that paid lost.',
    },
    {
      id: 'first', kind: 'decide', title: 'You are asked whether to cut spend today',
      options: [
        { id: 'tracking', label: 'Check whether tracking broke before touching spend', next: 'ios',
          reveals: 'Reads the tell. Paid falling while organic rises by the same amount is attribution moving, not demand moving, and cutting spend on a measurement artifact is expensive.',
          defense: 'You suspected attribution. What in the numbers made you confident enough to keep spending?' },
        { id: 'cut', label: 'Cut spend by half while you investigate', next: 'ios',
          reveals: 'Limits downside on a channel that may be broken. It also destroys the baseline you need to diagnose the problem and costs real volume if the channel is fine.',
          defense: 'You cut first. If it was a tracking bug, how would you have known once the data was disturbed?' },
        { id: 'holdout', label: 'Design a geo holdout to measure true incrementality', next: 'ios',
          reveals: 'Goes for the answer that survives any tracking change. Correct instrument, and it takes two weeks you do not have on a Monday.',
          defense: 'A holdout takes weeks. What did you tell the person asking about today\'s spend?' },
      ],
    },
    {
      id: 'ios', kind: 'reveal', next: 'report',
      title: 'What changed',
      body: 'A platform update over the weekend shortened the attribution window from 7 days to 1. The conversions did not disappear; they are landing in organic because the paid touch is no longer credited.',
    },
    {
      id: 'report', kind: 'decide', title: 'Your CAC target is set against the old numbers',
      options: [
        { id: 'restate', label: 'Restate history under the new window so the series is comparable', next: 'produce',
          reveals: 'Makes the trend readable at the cost of changing numbers people have already reported upward.',
          defense: 'You restated past months. Who had already reported the old numbers, and how did that land?' },
        { id: 'both', label: 'Report both windows in parallel until the target is reset', next: 'produce',
          reveals: 'Keeps continuity while the organisation adjusts. More complex, and two numbers for one thing invites people to quote the flattering one.',
          defense: 'You published two CACs. Which one did the leadership deck end up using?' },
        { id: 'model', label: 'Move to a modelled incrementality number and stop reporting platform CAC', next: 'produce',
          reveals: 'Fixes the underlying measurement rather than the presentation. Biggest change, hardest to explain, and it is the only version that survives the next platform update.',
          defense: 'You replaced a number people trusted with one they have to take on faith. How did you build that trust?' },
      ],
    },
    {
      id: 'produce', kind: 'produce', next: 'defend',
      title: 'The Monday note',
      body: 'Write what you would send at 10am: what happened, what you recommend on spend today, and what changes in reporting.',
    },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

export const CAMPAIGN = {
  id: 'brand-launch-1',
  specialization: 'brand-content',
  title: 'The launch line that tests badly',
  minutes: 30,
  skills: ['editorial judgement', 'reading qualitative feedback', 'defending a creative call'],
  brief: 'You are on a small brand team at a consumer company. A product launch is three weeks out and the campaign line has come back from testing.',
  steps: [
    {
      id: 'results', kind: 'reveal', next: 'read',
      title: 'The test',
      body: 'Your line scores 4.1 on a 7-point likeability scale. The safe alternative scores 5.8. In the open-text responses, your line draws strong reactions in both directions; the alternative draws almost none, mostly variations of "fine".',
    },
    {
      id: 'read', kind: 'decide', title: 'What do you take from a split reaction?',
      options: [
        { id: 'keep', label: 'Keep your line, on the argument that polarisation beats indifference', next: 'stakeholder',
          reveals: 'Reads the distribution rather than the mean. A line nobody objects to is often a line nobody remembers, and a small brand needs to be remembered.',
          defense: 'You overrode a 1.7-point gap on a distribution argument. What result would have changed your mind?' },
        { id: 'safe', label: 'Take the higher-scoring line', next: 'stakeholder',
          reveals: 'Follows the data as measured. Defensible, and likeability is a weak proxy for whether a line does any work.',
          defense: 'You took the higher score. What is the line actually meant to achieve, and does likeability measure it?' },
        { id: 'third', label: 'Go back and write a third option informed by both', next: 'stakeholder',
          reveals: 'Refuses a false choice between two tested options. Costs time you have three weeks of, and the third line will not be tested.',
          defense: 'Your third line ships untested. What made that an acceptable risk three weeks out?' },
      ],
    },
    {
      id: 'stakeholder', kind: 'reveal', next: 'decide2',
      title: 'The negative reactions have a pattern',
      body: 'Reading the open text, most of the strong negatives come from people outside the target segment. Within the target segment, your line outscores the alternative.',
    },
    {
      id: 'decide2', kind: 'decide', title: 'The sales lead has seen the headline 4.1 and wants the safe line',
      options: [
        { id: 'segment', label: 'Show the segment breakdown and hold your recommendation', next: 'produce',
          reveals: 'Argues with the evidence rather than authority. Requires the segment cut to be sound, and it puts you in open disagreement with sales.',
          defense: 'Your segment sample is smaller than the headline. Is it big enough to carry the argument you made with it?' },
        { id: 'concede', label: 'Concede the line and protect capital for the next disagreement', next: 'produce',
          reveals: 'Trades this decision for future ones. A real strategy, and it means the wrong line ships.',
          defense: 'You gave up a call you thought was right. What is the disagreement you were saving it for?' },
        { id: 'split-test', label: 'Propose running both in market and letting spend follow performance', next: 'produce',
          reveals: 'Converts an argument into a measurement. Costs budget and dilutes the launch, and it ends the disagreement.',
          defense: 'You split the launch to settle an argument. What did that cost the launch itself?' },
      ],
    },
    {
      id: 'produce', kind: 'produce', next: 'defend',
      title: 'The recommendation',
      body: 'Write the note you would send: the line you are recommending, and the single strongest argument against it.',
    },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

export const MARKDOWN = {
  id: 'merch-markdown-1',
  specialization: 'merchandising',
  title: 'The category that is sitting',
  minutes: 35,
  skills: ['inventory analysis', 'margin trade-offs', 'buying judgement'],
  brief: 'You support a buying team at a multi-store retailer. Week nine of a twelve-week season and one category is well behind plan.',
  steps: [
    {
      id: 'position', kind: 'reveal', next: 'act',
      title: 'The position',
      body: 'Sell-through is 41% against a 65% plan at this point. You are carrying 14 weeks of cover on the category. Two of eleven SKUs account for most of the shortfall, and both are the highest-margin items in the range.',
    },
    {
      id: 'act', kind: 'decide', title: 'What do you do in week nine?',
      options: [
        { id: 'markdown', label: 'Mark down the two slow SKUs now', next: 'store',
          reveals: 'Clears inventory while there is still season left to sell into. Takes the margin hit on exactly the items that were meant to carry the category.',
          defense: 'You marked down your highest-margin SKUs. What did that do to category margin, and was there a cheaper lever?' },
        { id: 'diagnose', label: 'Work out why those two are not selling before discounting', next: 'store',
          reveals: 'Refuses to treat every slow SKU as a price problem. Right instinct, and every week spent diagnosing is a week of season gone.',
          defense: 'You spent time diagnosing in week nine of twelve. What did you find, and was it worth the weeks?' },
        { id: 'move', label: 'Reallocate the stock to the stores where it is selling', next: 'store',
          reveals: 'Fixes distribution before touching price. Cheapest lever available if the problem is placement rather than product.',
          defense: 'You moved stock instead of discounting. What did the transfer cost, and how long did it take to land?' },
      ],
    },
    {
      id: 'store', kind: 'reveal', next: 'next',
      title: 'What the store data shows',
      body: 'Both SKUs sell through fine in six stores and barely move in the other twenty-two. In the twenty-two, they were placed at the back of the category. In the six, they sit at the front.',
    },
    {
      id: 'next', kind: 'decide', title: 'It is a placement problem, and changing placement takes three weeks',
      options: [
        { id: 'placement', label: 'Push the placement change and hold price', next: 'produce',
          reveals: 'Fixes the actual cause and protects margin. Three of your remaining weeks go to execution, and store compliance is never complete.',
          defense: 'Placement changes land unevenly. What is your plan if half the stores do not comply in time?' },
        { id: 'both', label: 'Change placement and take a modest markdown to cover the timing', next: 'produce',
          reveals: 'Hedges the execution risk with a smaller margin hit than a full markdown. Costs some margin to buy certainty.',
          defense: 'You did both. If placement alone would have worked, what did the markdown cost you?' },
        { id: 'next-season', label: 'Hold price, accept the season, and fix the planogram for next', next: 'produce',
          reveals: 'Protects margin and treats it as a structural lesson. Leaves you carrying the stock into a clearance that will cost more than the markdown would have.',
          defense: 'You chose to carry it. What happens to that inventory in week thirteen?' },
      ],
    },
    {
      id: 'produce', kind: 'produce', next: 'defend',
      title: 'The action',
      body: 'Write the recommendation to the buying lead: what you are doing this week, and what it costs.',
    },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

export const SUPPLY = {
  id: 'supply-shortfall-1',
  specialization: 'supply-chain',
  title: 'The shipment that will not arrive',
  minutes: 35,
  skills: ['allocation under scarcity', 'supplier management', 'communicating bad news'],
  brief: 'You are a planning analyst at a consumer goods company. A supplier has just confirmed a shipment will land four weeks late.',
  steps: [
    {
      id: 'gap', kind: 'reveal', next: 'allocate',
      title: 'The gap',
      body: 'The delayed shipment covers 60% of a component used in three products. You have four weeks of cover. One product is a new launch with committed retailer dates. The other two are steady sellers, one of which is your highest-margin line.',
    },
    {
      id: 'allocate', kind: 'decide', title: 'How do you allocate what you have?',
      options: [
        { id: 'launch', label: 'Protect the launch and let the steady lines go short', next: 'supplier',
          reveals: 'Protects the commitment with a date attached and the retailer relationship behind it. The steady lines lose shelf presence that is hard to win back.',
          defense: 'You protected the launch. What happens to the shelf space the steady lines lose in those four weeks?' },
        { id: 'margin', label: 'Protect the highest-margin line', next: 'supplier',
          reveals: 'Optimises the financial result for the quarter. Misses a committed launch date, which is a different kind of cost and lands on a relationship rather than a P&L.',
          defense: 'You optimised for margin and missed a committed date. How did that conversation with the retailer go?' },
        { id: 'pro-rata', label: 'Spread the shortage evenly across all three', next: 'supplier',
          reveals: 'Avoids choosing. Feels fair internally and means all three underperform, including the one with a contractual date.',
          defense: 'Spreading it meant nothing was protected. Was that a decision or an avoidance of one?' },
      ],
    },
    {
      id: 'supplier', kind: 'reveal', next: 'tell',
      title: 'The supplier offers a partial',
      body: 'They can air-freight 25% of the volume within a week at roughly eight times the sea cost. It would cover the launch alone, and the cost wipes out the launch\'s first-quarter margin entirely.',
    },
    {
      id: 'tell', kind: 'decide', title: 'Do you spend it?',
      options: [
        { id: 'airfreight', label: 'Take the air freight to hold the launch date', next: 'produce',
          reveals: 'Buys the commitment at a price that erases its own return. Defensible if the relationship outlives the quarter.',
          defense: 'You spent the launch\'s entire first-quarter margin on freight. Who signed that off, and what did you tell them it bought?' },
        { id: 'renegotiate', label: 'Go to the retailer and renegotiate the date before spending', next: 'produce',
          reveals: 'Tests whether the date is actually immovable before paying to meet it. Costs credibility to ask, and it is usually cheaper than eight times freight.',
          defense: 'You asked to move the date. What did you offer them in exchange?' },
        { id: 'partial', label: 'Air-freight enough for a soft launch and follow with sea freight', next: 'produce',
          reveals: 'Meets the date at reduced volume rather than paying full price for full volume. The launch is quieter than planned.',
          defense: 'You met the date with less product. Is a thin launch better or worse than a late one?' },
      ],
    },
    {
      id: 'produce', kind: 'produce', next: 'defend',
      title: 'The plan',
      body: 'Write the allocation decision and the message you would send the commercial team.',
    },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

export const MARKETPLACE = {
  id: 'ecom-returns-1',
  specialization: 'ecommerce-marketplace',
  title: 'The seller with perfect reviews',
  minutes: 35,
  skills: ['marketplace integrity', 'evidence thresholds', 'balancing supply against trust'],
  brief: 'You work on marketplace operations. A seller flagged by an automated check is one of your top twenty by volume.',
  steps: [
    {
      id: 'flag', kind: 'reveal', next: 'first',
      title: 'The flag',
      body: 'The seller has a 4.9 rating across 3,100 reviews. Return rate is 0.4% against a 6% category average. Review timestamps cluster in bursts. Roughly 30% of reviewers have reviewed only this seller.',
    },
    {
      id: 'first', kind: 'decide', title: 'None of that is proof. What do you do?',
      options: [
        { id: 'investigate', label: 'Open a full investigation before any action', next: 'evidence',
          reveals: 'Establishes the facts before touching a large seller. Takes time during which any manipulation continues and buyers keep relying on the rating.',
          defense: 'You investigated first. How long did buyers keep seeing a rating you already suspected?' },
        { id: 'suppress', label: 'Suppress the suspect reviews now, investigate after', next: 'evidence',
          reveals: 'Protects buyers immediately. Acts against a seller on a pattern rather than a finding, and a wrong call here is very visible.',
          defense: 'You acted before you had proof. What would you have done if the investigation cleared them?' },
        { id: 'contact', label: 'Contact the seller and ask them to explain the pattern', next: 'evidence',
          reveals: 'Gives them a chance to explain a pattern that can have innocent causes. Also tells anyone manipulating reviews that they have been noticed.',
          defense: 'You tipped off a seller you suspected. What did you expect them to do next?' },
      ],
    },
    {
      id: 'evidence', kind: 'reveal', next: 'call',
      title: 'What the investigation finds',
      body: 'The low return rate is real: the seller refunds off-platform and asks buyers not to file returns. This breaks marketplace policy, keeps their metrics artificially clean, and leaves buyers without platform protection. The reviews themselves appear genuine.',
    },
    {
      id: 'call', kind: 'decide', title: 'A real violation, a top-twenty seller, and no fake reviews',
      options: [
        { id: 'suspend', label: 'Suspend the seller under the policy as written', next: 'produce',
          reveals: 'Applies the rule consistently regardless of size, which is the only way the rule keeps meaning anything. Removes real supply and real revenue.',
          defense: 'You suspended a top-twenty seller. What did you say to the commercial team who owns that relationship?' },
        { id: 'warn', label: 'Warn, require corrected process, and monitor closely', next: 'produce',
          reveals: 'Corrects behaviour while keeping supply. It also means a large seller got a warning where a small one would have been suspended, and that becomes precedent.',
          defense: 'A small seller doing this would likely have been suspended. How do you defend the difference?' },
        { id: 'metrics', label: 'Suspend, and separately fix the metric that rewarded hiding returns', next: 'produce',
          reveals: 'Treats the seller and the incentive as two problems. The system rewarded exactly this behaviour and will reward the next seller too.',
          defense: 'You changed the metric. Which other sellers were quietly doing the same thing under it?' },
      ],
    },
    {
      id: 'produce', kind: 'produce', next: 'defend',
      title: 'The decision',
      body: 'Write the action you would take and the note that goes on the seller\'s file.',
    },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

// ── Professional services ─────────────────────────────────────────────────────────────

export const ENGAGEMENT = {
  id: 'consulting-scope-1',
  specialization: 'management-consulting',
  title: 'The answer the client does not want',
  minutes: 40,
  skills: ['structuring an ambiguous problem', 'client management', 'defending an unwelcome finding'],
  brief: 'You are an analyst on a four-week cost reduction engagement. Two weeks in, the analysis is pointing somewhere the client did not expect.',
  steps: [
    {
      id: 'finding', kind: 'reveal', next: 'first',
      title: 'What the numbers say',
      body: 'The brief was to find 15% in operations. Operations is already lean; you can find 4% at most. The 15% is available almost entirely in a division the sponsor built and still runs.',
    },
    {
      id: 'first', kind: 'decide', title: 'Two weeks left. What do you do with that?',
      options: [
        { id: 'raise', label: 'Take it to the engagement manager immediately', next: 'sponsor',
          reveals: 'Escalates a scope-breaking finding to the person who can renegotiate it, while there is still time to act on it.',
          defense: 'You escalated at week two. What did you want the manager to do that you could not?' },
        { id: 'verify', label: 'Verify it hard before telling anyone', next: 'sponsor',
          reveals: 'Makes sure a career-affecting finding is right before it moves. Sensible, and every day spent verifying is a day the team works to the wrong brief.',
          defense: 'You verified before escalating. How long did that take, and what was the team doing meanwhile?' },
        { id: 'both-paths', label: 'Keep working the original scope and build the second finding alongside', next: 'sponsor',
          reveals: 'Delivers what was asked and what is true. Doubles your workload in the back half of an engagement.',
          defense: 'You ran two workstreams on your own. What slipped?' },
      ],
    },
    {
      id: 'sponsor', kind: 'reveal', next: 'deck',
      title: 'The manager\'s response',
      body: 'The manager agrees the finding is real and says the sponsor is unlikely to accept it. There is a follow-on engagement being discussed. They ask you how you would present it.',
    },
    {
      id: 'deck', kind: 'decide', title: 'How do you present a finding that implicates the person paying?',
      options: [
        { id: 'lead', label: 'Lead with it, evidenced, in the main deck', next: 'produce',
          reveals: 'Refuses to bury the answer to the question that was asked. Highest integrity, highest risk to the relationship and the follow-on.',
          defense: 'You led with the finding. What happened in the room, and would you do it the same way again?' },
        { id: 'appendix', label: 'Deliver the 4% as headline, with the larger finding fully evidenced behind it', next: 'produce',
          reveals: 'Technically discloses everything. A finding in an appendix is a finding the sponsor can choose not to see, which is often the point.',
          defense: 'You put the real answer behind the safe one. If the sponsor never turns the page, did you deliver the engagement?' },
        { id: 'private', label: 'Brief the sponsor privately before it reaches a room', next: 'produce',
          reveals: 'Lets the sponsor absorb it without an audience, which is often how difficult findings actually land. It also gives one person the chance to bury it.',
          defense: 'You gave the sponsor advance notice. What would you have done if they asked you to leave it out?' },
      ],
    },
    {
      id: 'produce', kind: 'produce', next: 'defend',
      title: 'The page',
      body: 'Write the executive summary page: what you found, what you recommend, and what you were asked to find.',
    },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

export const LANDSCAPE = {
  id: 'strategy-entry-1',
  specialization: 'strategy-research',
  title: 'The market that looks bigger than it is',
  minutes: 35,
  skills: ['market sizing', 'source quality', 'stating uncertainty'],
  brief: 'You are asked to size a market for an entry decision. The number you produce will go in front of a board next month.',
  steps: [
    {
      id: 'sources', kind: 'reveal', next: 'method',
      title: 'What is available',
      body: 'Three industry reports put the market at $2.1bn, $4.8bn and $11bn. All three are behind paywalls; you have the summary pages. The $11bn figure is the most cited, and tracing citations shows most of them lead back to the same vendor press release.',
    },
    {
      id: 'method', kind: 'decide', title: 'Which number do you build on?',
      options: [
        { id: 'bottom-up', label: 'Build your own bottom-up estimate and use the reports as a check', next: 'gap',
          reveals: 'Produces a number you can actually defend line by line. Slower, and the assumptions become yours to own.',
          defense: 'Your bottom-up number is yours to defend. Which assumption in it is weakest?' },
        { id: 'range', label: 'Present the range and explain what drives the spread', next: 'gap',
          reveals: 'Honest about the state of the evidence. A board asked for a number will often just take the middle of your range.',
          defense: 'You gave a range and the board needs a decision. Which end would you actually plan against?' },
        { id: 'conservative', label: 'Take the lowest credible figure and note the others', next: 'gap',
          reveals: 'Errs toward not overstating. Conservative is not the same as accurate, and a market can be understated into a missed opportunity.',
          defense: 'You took the low number for safety. What is the cost of being wrong in that direction?' },
      ],
    },
    {
      id: 'gap', kind: 'reveal', next: 'present',
      title: 'What the spread turns out to be',
      body: 'The three numbers use three different definitions. The $11bn includes adjacent services the company would not sell. The $2.1bn covers only direct competitors. Neither report states its definition on the summary page.',
    },
    {
      id: 'present', kind: 'decide', title: 'The board wants one number',
      options: [
        { id: 'define', label: 'Give one number with the definition stated above it', next: 'produce',
          reveals: 'Makes the definition part of the number rather than a footnote. This is the difference between a sizing and a citation.',
          defense: 'Your definition excludes things a competitor would count. How do you handle being challenged on it in the room?' },
        { id: 'scenarios', label: 'Give three numbers tied to three strategic scopes', next: 'produce',
          reveals: 'Turns a measurement question into a strategy question, which is what it actually is. Harder to present and more useful.',
          defense: 'You handed the board a decision rather than a number. Were they equipped to make it?' },
        { id: 'serviceable', label: 'Size only what the company could realistically serve in three years', next: 'produce',
          reveals: 'Answers the question behind the question. Smallest number in the room and the only one connected to a plan.',
          defense: 'Your number is a fraction of the cited market. How do you stop it reading as pessimism?' },
      ],
    },
    {
      id: 'produce', kind: 'produce', next: 'defend',
      title: 'The sizing',
      body: 'State your number, the definition it rests on, and the one assumption that would change it most.',
    },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

export const SIGNAL = {
  id: 'intel-competitor-1',
  specialization: 'market-intelligence',
  title: 'The competitor move you cannot confirm',
  minutes: 30,
  skills: ['source triangulation', 'confidence calibration', 'reporting under uncertainty'],
  brief: 'You track competitors for a commercial team. Something is happening at your largest rival and nobody will confirm it.',
  steps: [
    {
      id: 'signals', kind: 'reveal', next: 'chase',
      title: 'What you have',
      body: 'Nine engineering roles posted in a city where they have no office. Two senior people updated titles to a product line that does not exist publicly. A partner mentioned offhand that their roadmap conversation "got vague". No announcement, no filing, no press.',
    },
    {
      id: 'chase', kind: 'decide', title: 'What do you do with three weak signals?',
      options: [
        { id: 'triangulate', label: 'Look for a fourth independent signal before reporting', next: 'pressure',
          reveals: 'Refuses to report a pattern built from three soft sources. Costs time, and the value of competitive intelligence decays fast.',
          defense: 'You waited for confirmation. What was the cost of the delay if you were right?' },
        { id: 'report-low', label: 'Report now with an explicit low confidence rating', next: 'pressure',
          reveals: 'Gets the signal to people who can act while being honest about its strength. Depends entirely on whether readers respect confidence ratings.',
          defense: 'You labelled it low confidence. Did the sales team read the label or the headline?' },
        { id: 'customers', label: 'Ask your own customers what they are hearing', next: 'pressure',
          reveals: 'Goes to a source with real visibility. It also signals to customers that you are worried about a competitor.',
          defense: 'You asked customers about a rival. What did that tell them about your position?' },
      ],
    },
    {
      id: 'pressure', kind: 'reveal', next: 'brief',
      title: 'It gets urgent',
      body: 'A sales director hears a rumour secondhand and asks you to confirm it in a deal review tomorrow. The deal is large and the customer has asked directly about your roadmap versus the rival\'s.',
    },
    {
      id: 'brief', kind: 'decide', title: 'You still cannot confirm it',
      options: [
        { id: 'say-so', label: 'Say plainly that it is unconfirmed and give the underlying signals', next: 'produce',
          reveals: 'Hands over the evidence rather than a conclusion, and lets the director weigh it. Less satisfying than an answer and more honest.',
          defense: 'You gave signals instead of an answer. What did the director do with them?' },
        { id: 'assess', label: 'Give a probability estimate with your reasoning attached', next: 'produce',
          reveals: 'Commits to a judgement that can be checked later, which is what an analyst is for. Requires being wrong in public sometimes.',
          defense: 'You put a number on it. What happens to your credibility when that number is wrong?' },
        { id: 'decline', label: 'Decline to brief and explain what would be needed to confirm', next: 'produce',
          reveals: 'Protects against a bad call driving a large deal. It also leaves the director walking in with nothing.',
          defense: 'You declined and they went in without you. Was that better than an uncertain assessment?' },
      ],
    },
    {
      id: 'produce', kind: 'produce', next: 'defend',
      title: 'The brief',
      body: 'Write what you would send before the deal review: what you know, how confident you are, and what would change it.',
    },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

export const CONTRACT = {
  id: 'legalops-intake-1',
  specialization: 'legal-operations',
  title: 'The approval nobody waits for',
  minutes: 30,
  skills: ['process design', 'risk triage', 'getting compliance without authority'],
  brief: 'You are in legal operations at a growing company. Contract review is a bottleneck and people have started routing around it.',
  steps: [
    {
      id: 'state', kind: 'reveal', next: 'design',
      title: 'Where things stand',
      body: 'Median review time is 11 days against a 3-day target. Sales has begun sending customer-paper contracts straight to signature. In the last quarter, 34 agreements were executed without review; three contained uncapped liability.',
    },
    {
      id: 'design', kind: 'decide', title: 'How do you fix a process people are already bypassing?',
      options: [
        { id: 'tier', label: 'Tier contracts by risk so low-risk ones self-serve', next: 'pushback',
          reveals: 'Puts legal time where risk actually is. Requires a tiering rule sound enough that a wrong classification is rare and survivable.',
          defense: 'Your tiering lets some contracts through unreviewed by design. Which one would hurt most if you classified it wrong?' },
        { id: 'enforce', label: 'Block signature authority until review is complete', next: 'pushback',
          reveals: 'Closes the bypass with a control. It also makes an 11-day queue mandatory, which turns a compliance problem into a revenue one.',
          defense: 'You made an 11-day queue compulsory. What did that do to deals in the quarter?' },
        { id: 'sla', label: 'Fix the 11 days first, then re-earn the routing', next: 'pushback',
          reveals: 'Treats the bypass as a symptom. Correct diagnosis, and it leaves contracts going unreviewed while you work on throughput.',
          defense: 'You fixed speed before control. How many uncapped-liability contracts were signed while you did?' },
      ],
    },
    {
      id: 'pushback', kind: 'reveal', next: 'ship',
      title: 'The pushback',
      body: 'The general counsel wants every contract reviewed. The sales lead says any mandatory queue will be worked around again. You have authority over neither.',
    },
    {
      id: 'ship', kind: 'decide', title: 'Two people who both outrank you want opposite things',
      options: [
        { id: 'pilot', label: 'Propose a 60-day pilot of tiering with measured outcomes', next: 'produce',
          reveals: 'Converts a standoff into evidence, and makes it reversible so neither side has to concede permanently.',
          defense: 'What result at day sixty would have made you recommend abandoning tiering?' },
        { id: 'data', label: 'Show what the 34 bypassed contracts actually cost and let that decide', next: 'produce',
          reveals: 'Puts a real number on the status quo, which is the strongest argument available to someone with no authority.',
          defense: 'If the 34 bypassed contracts had cost nothing, what would your recommendation have been?' },
        { id: 'gc', label: 'Back the general counsel and implement full review', next: 'produce',
          reveals: 'Aligns with the person accountable for legal risk. Safe, and it implements the option you have evidence will be bypassed.',
          defense: 'You backed the position you expected to fail. Why was that the right call?' },
      ],
    },
    {
      id: 'produce', kind: 'produce', next: 'defend',
      title: 'The proposal',
      body: 'Write the one-page proposal: the process, who it needs agreement from, and how you would know it is working.',
    },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

export const DOCS = {
  id: 'techwriting-api-1',
  specialization: 'technical-writing',
  title: 'The documentation that is technically correct',
  minutes: 30,
  skills: ['audience judgement', 'working with engineers', 'knowing what to leave out'],
  brief: 'You are documenting a public API. Support tickets suggest the docs are not doing their job.',
  steps: [
    {
      id: 'tickets', kind: 'reveal', next: 'first',
      title: 'What support sees',
      body: 'Every endpoint is documented with parameters, types and an example response. 60% of tickets are people asking which of three authentication flows to use. The docs describe all three accurately and never say which is for whom.',
    },
    {
      id: 'first', kind: 'decide', title: 'The reference is complete and it is not working',
      options: [
        { id: 'guide', label: 'Write a decision guide that recommends one flow by use case', next: 'engineer',
          reveals: 'Adds the judgement the reference deliberately omits. Requires taking a position engineering may not want documented.',
          defense: 'You recommended one flow. What happens to readers whose case does not fit the one you picked?' },
        { id: 'reorder', label: 'Restructure so the common flow is the default path', next: 'engineer',
          reveals: 'Answers by structure rather than by prose. Effective, and it makes the other two flows harder to find for the people who need them.',
          defense: 'You buried two flows to surface one. Who did that cost?' },
        { id: 'quickstart', label: 'Add a quickstart that gets one flow working end to end', next: 'engineer',
          reveals: 'Gives a reader a working thing before asking them to choose. Strongest for new users and does nothing for someone mid-migration.',
          defense: 'Your quickstart serves new users. What about the ones already integrated on the wrong flow?' },
      ],
    },
    {
      id: 'engineer', kind: 'reveal', next: 'ship',
      title: 'Engineering pushes back',
      body: 'The engineer who owns the API says all three flows are supported and singling one out will "make people think the others are deprecated". They are not deprecated, and internally everyone knows which one to use.',
    },
    {
      id: 'ship', kind: 'decide', title: 'The knowledge exists and is not written down',
      options: [
        { id: 'hold', label: 'Push back: undocumented internal consensus is the actual problem', next: 'produce',
          reveals: 'Names the thing generating 60% of tickets. Correct, and it requires disagreeing with the person whose review you need.',
          defense: 'You told the API owner the docs were the problem. How did you keep that conversation working?' },
        { id: 'soften', label: 'Recommend by use case rather than ranking the flows', next: 'produce',
          reveals: 'Gets the guidance in while respecting the objection. The reader still gets an answer; nothing reads as deprecated.',
          defense: 'You framed it by use case. Does a reader in a hurry still land on the right flow?' },
        { id: 'data', label: 'Bring the ticket data and let it carry the argument', next: 'produce',
          reveals: 'Replaces an opinion disagreement with evidence. Slower, and it is what changes an engineer\'s mind.',
          defense: 'The data showed 60% of tickets. What did the API owner say to that?' },
      ],
    },
    {
      id: 'produce', kind: 'produce', next: 'defend',
      title: 'The page',
      body: 'Write the section that resolves the authentication question, in the form you would actually ship.',
    },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

export const SCENARIOS_2 = [
  LBO, PIPELINE, MANDATE, LEDGER,
  CLINIC, COHORT, CLAIMS, DEVIATION, ONBOARD,
  CHANNEL, CAMPAIGN, MARKDOWN, SUPPLY, MARKETPLACE,
  ENGAGEMENT, LANDSCAPE, SIGNAL, CONTRACT, DOCS,
];

// ── The Polymath Builder Challenge (§7) ───────────────────────────────────────────────
// Longer than the others and shaped differently on purpose. Every other scenario holds its
// problem still. This one changes the requirements three times after the candidate has
// committed, because the thing being read is not whether the first design was good. It is
// whether they can say what their design assumed, notice when that assumption stops holding,
// and change the right part rather than the whole thing.
//
// There is no correct architecture here. Each opening choice is defensible and each is made
// uncomfortable by a later requirement, so nobody escapes without a trade to account for.
export const POLYMATH = {
  id: 'swe-polymath-builder-1',
  // Deliberately NOT any batch's specialisation. Every specialisation already has a default
  // sitting and scenarioFor() picks the first match, so claiming 'product-engineering' here
  // would have silently replaced the inherited-bug scenario for everyone applying to it. The
  // engine requires a specialisation, so this carries its own, which no batch claims: it is
  // reachable through optionalScenariosFor() and nowhere else.
  specialization: 'polymath-builder',
  optional: true,
  offeredTo: ['software-ai'],
  title: 'The requirements keep moving',
  minutes: 55,
  skills: ['architecture under ambiguity', 'learning velocity', 'systems thinking', 'security judgement'],
  brief: 'You are given a vague brief, no implementation instructions, and a deadline. It will change three times. Synthetic throughout: no real system, users or data.',
  steps: [
    {
      id: 'brief', kind: 'reveal', next: 'clarify',
      title: 'The whole brief',
      body: '"Build an API that processes user data." That is all of it. The person who wrote it is unavailable for the next two hours.',
    },
    {
      id: 'clarify', kind: 'decide', title: 'Two hours, nobody to ask. What do you do first?',
      options: [
        { id: 'assume', label: 'Write down your assumptions, then build against them', next: 'design',
          reveals: 'Makes the ambiguity explicit before committing. The assumptions become a document that can be checked later, which is what makes a wrong one cheap.',
          defense: 'You wrote assumptions down. Which one were you least sure of, and what would it have cost to be wrong?' },
        { id: 'narrow', label: 'Build the smallest thing that could possibly be what they meant', next: 'design',
          reveals: 'Produces something real to react to, which is often faster than guessing correctly. Risks building the wrong small thing well.',
          defense: 'You built small to get feedback. What did you deliberately leave out, and how did you decide?' },
        { id: 'general', label: 'Build it general enough to cover several readings of the brief', next: 'design',
          reveals: 'Hedges against being wrong by supporting more cases. Costs time now and carries abstraction that may never earn itself back.',
          defense: 'You generalised before you knew what was needed. Which of those cases turned out to matter?' },
      ],
    },
    {
      id: 'design', kind: 'decide', title: 'How do you store and process it?',
      options: [
        { id: 'sync-sql', label: 'Synchronous handler writing straight to Postgres', next: 'scale',
          reveals: 'Simplest thing that works, and easiest to reason about when it breaks. Every request holds a connection for as long as the work takes.',
          defense: 'Your handler does the work inline. What is the first thing that saturates?' },
        { id: 'queue', label: 'Accept, enqueue, process in a worker', next: 'scale',
          reveals: 'Decouples arrival from processing, so a slow step cannot block intake. Adds a queue, a worker and a whole class of failure that is invisible from the endpoint.',
          defense: 'You added a queue on day one. How does a caller find out their job failed?' },
        { id: 'serverless', label: 'Stateless functions with a managed datastore', next: 'scale',
          reveals: 'Pushes scaling and uptime onto the platform. Fewer things to run, and the constraints are now someone else\'s to change.',
          defense: 'You handed the hard parts to a platform. Which of its limits did you check before choosing it?' },
      ],
    },
    {
      id: 'scale', kind: 'reveal', next: 'scale-decide',
      title: 'The requirement changes',
      body: 'Traffic is now expected to be 100x what you designed for. The deadline has not moved.',
    },
    {
      id: 'scale-decide', kind: 'decide', title: 'What do you change?',
      options: [
        { id: 'measure', label: 'Find the actual bottleneck before changing anything', next: 'sensitive',
          reveals: 'Refuses to optimise on a guess. Costs time under a deadline, and it is the only way to avoid rewriting the part that was never the problem.',
          defense: 'You measured first. What did you find, and was it where you expected?' },
        { id: 'horizontal', label: 'Scale horizontally and move the slow work off the request path', next: 'sensitive',
          reveals: 'The change that usually works, applied without confirming this is the usual case. Fast, and it can leave a shared bottleneck untouched behind more instances.',
          defense: 'You added instances. What in your design is still shared, and does it scale with them?' },
        { id: 'rewrite', label: 'Redesign around the new number', next: 'sensitive',
          reveals: 'Treats a 100x change as a different problem rather than a bigger one, which it sometimes is. Spends the remaining time on architecture rather than delivery.',
          defense: 'You restarted the design with the deadline unchanged. What did you give up to afford that?' },
      ],
    },
    {
      id: 'sensitive', kind: 'reveal', next: 'sensitive-decide',
      title: 'It changes again',
      body: 'The data now includes sensitive personal information. Nothing else about the brief has changed, and your design assumed it did not matter who could read the store.',
    },
    {
      id: 'sensitive-decide', kind: 'decide', title: 'This is not a feature. What do you do?',
      options: [
        { id: 'stop', label: 'Stop and establish what the obligations actually are', next: 'latency',
          reveals: 'Recognises that this changes what "done" means rather than adding a task. The one option that treats a legal and ethical constraint as a constraint.',
          defense: 'You stopped building. Who did you need an answer from, and what would you have done if nobody answered?' },
        { id: 'encrypt', label: 'Encrypt at rest and in transit, restrict access, keep going', next: 'latency',
          reveals: 'The competent technical response. It covers the storage question and says nothing about retention, access logging, or who is allowed to see it at all.',
          defense: 'You secured the data. Who can still read it, and how would you know if they had?' },
        { id: 'minimise', label: 'Change the design to hold less of it', next: 'latency',
          reveals: 'Attacks the exposure rather than defending it. The strongest version, and it means going back on decisions already made.',
          defense: 'You reduced what you store. What did the product lose, and who agreed to that?' },
      ],
    },
    {
      id: 'latency', kind: 'reveal', next: 'latency-decide',
      title: 'And once more',
      body: 'p99 latency must come down by half. Your security work added a hop. Both requirements are live and neither has been withdrawn.',
    },
    {
      id: 'latency-decide', kind: 'decide', title: 'The two most recent requirements are pulling against each other',
      options: [
        { id: 'surface', label: 'Say so, with the cost of each option, and ask for a decision', next: 'produce',
          reveals: 'Puts a genuine trade in front of whoever owns it instead of quietly resolving it. The right move when both constraints came from outside.',
          defense: 'You escalated the conflict. What did you recommend, and what would you have done if the answer was "both"?' },
        { id: 'optimise', label: 'Find the latency somewhere other than the security path', next: 'produce',
          reveals: 'Assumes the conflict is not real until proven, which is often true. Costs the time to establish it and may not be enough on its own.',
          defense: 'You protected the security work. What did you have to give up elsewhere to find the time back?' },
        { id: 'security-first', label: 'Hold the security design and miss the latency target', next: 'produce',
          reveals: 'Ranks the two constraints and says which loses. Defensible and it is a decision that was not yours to make alone.',
          defense: 'You chose which requirement to miss. Who found out, and when?' },
      ],
    },
    {
      id: 'produce', kind: 'produce', next: 'defend',
      title: 'The design, as it actually ended up',
      body: 'Describe what you would ship: the architecture, the assumption it still rests on, and the one thing you would fix first with another week.',
    },
    { id: 'defend', kind: 'defend', title: 'Defend your own decisions' },
  ],
};

SCENARIOS_2.push(POLYMATH);
