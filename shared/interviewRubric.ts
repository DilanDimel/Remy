// Interview scoring guide: role profiles, criteria and four-level anchors. Ported from Julio's interview coach
// (English catalog, release f9b751a, Nov 2026; sources listed in his Remy-Interview-Rubric.md). Weights are editorial,
// not validated against hiring outcomes. "expert": a role-skill criterion an expert would need to confirm.
// "measurement": "interaction" needs another person's turns; "work_sample" needs a work-sample question.
/* eslint-disable */
export const CRITERIA = {
 "answer_focus": {
  "dimension": "relevance",
  "label": "Relevance",
  "description": "Assesses whether the answer addresses the task, not how eloquent it sounds.",
  "anchors": [
   "Answers a different topic without addressing the question.",
   "Addresses one part but leaves out a central condition.",
   "Addresses the objective and its main conditions.",
   "Addresses the objective, prioritizes what matters and defines what remains outside the scope."
  ],
  "dos": [
   "Identify what you are being asked.",
   "Answer the central point first."
  ],
  "depends": [
   "Clarifying an ambiguous question may be necessary."
  ],
  "donts": [
   "Replacing the answer with a memorized speech."
  ],
  "followUp": "What part of the question have you not answered?",
  "exercise": "Summarize the task and respond in three points."
 },
 "context": {
  "dimension": "evidence",
  "label": "Checkable context",
  "description": "Assesses the information needed to understand the example; confidential information is not required.",
  "anchors": [
   "Does not establish the experience or makes incompatible claims.",
   "Mentions the context but omits the objective or constraints.",
   "Explains the objective, situation and relevant constraints.",
   "Selects the necessary context and distinguishes known facts from estimates."
  ],
  "dos": [
   "Explain the objective and constraints."
  ],
  "depends": [
   "Anonymize confidential information."
  ],
  "donts": [
   "Inventing details to appear specific."
  ],
  "followUp": "What objective and constraint shaped that situation?",
  "exercise": "Rewrite the context without names or sensitive information."
 },
 "ownership": {
  "dimension": "evidence",
  "label": "Personal contribution",
  "description": "Distinguishes individual contributions from shared work.",
  "anchors": [
   "Attributes an action to the team without clarifying personal involvement.",
   "Names an individual task without explaining how it was done.",
   "Describes personal actions and distinguishes them from the team’s actions.",
   "Explains responsibilities, actions and coordination without claiming other people’s work."
  ],
  "dos": [
   "Describe what you did and what other people did."
  ],
  "depends": [
   "A supporting role can also provide evidence."
  ],
  "donts": [
   "Claiming other people’s achievements."
  ],
  "followUp": "What action did you personally take?",
  "exercise": "Separate your contribution and the team’s contribution into two columns."
 },
 "outcomes": {
  "dimension": "evidence",
  "label": "Results and limitations",
  "description": "Assesses how the result is supported, not the size of the achievement.",
  "anchors": [
   "Claims success without describing any result.",
   "Describes a result without a reference point for interpreting it.",
   "Explains what happened and the evidence supporting that account.",
   "Relates the result to the objective, acknowledges attribution limits and identifies what was not measured."
  ],
  "dos": [
   "Use real results and explain how you know about them."
  ],
  "depends": [
   "Qualitative evidence may be sufficient."
  ],
  "donts": [
   "Inventing metrics or claiming causality that has not been established."
  ],
  "followUp": "How did you know that result had occurred?",
  "exercise": "Add one piece of real evidence and one limitation to your example."
 },
 "problem_framing": {
  "dimension": "reasoning",
  "label": "Problem framing",
  "description": "Assesses how the problem is framed, separately from the technical correctness of a solution.",
  "anchors": [
   "Proposes action without defining the problem to solve.",
   "Identifies an objective but omits a decisive constraint.",
   "Defines the objective, constraints and necessary information.",
   "Prioritizes uncertainties and explains how they would change the approach."
  ],
  "dos": [
   "Clarify the objective and constraints before solving the problem."
  ],
  "depends": [
   "The necessary depth depends on the complexity of the case."
  ],
  "donts": [
   "Solving a different assumed problem without saying so."
  ],
  "followUp": "What missing information would change your approach most?",
  "exercise": "Write down the objective, constraints and two unknowns."
 },
 "decision_tradeoffs": {
  "dimension": "reasoning",
  "label": "Decisions and alternatives",
  "description": "Assesses the reasoning behind choosing among options; it does not establish specialist knowledge.",
  "anchors": [
   "Chooses an action without providing reasons.",
   "Provides a reason but does not consider a relevant alternative.",
   "Compares options using relevant criteria.",
   "Explains trade-offs and what evidence would change the decision."
  ],
  "dos": [
   "Compare relevant alternatives."
  ],
  "depends": [
   "Not every task requires multiple options."
  ],
  "donts": [
   "Presenting preferences as facts."
  ],
  "followUp": "What alternative did you reject, and why?",
  "exercise": "Compare two options using the same criterion."
 },
 "uncertainty": {
  "dimension": "reasoning",
  "label": "Uncertainty and verification",
  "description": "Assesses how facts, assumptions and limitations are distinguished.",
  "anchors": [
   "Presents an unsupported conclusion with certainty.",
   "Acknowledges uncertainty but does not identify what needs checking.",
   "Distinguishes assumptions and proposes a relevant check.",
   "Prioritizes checks and explains how their results would change the conclusion."
  ],
  "dos": [
   "State your assumptions explicitly."
  ],
  "depends": [
   "Verification depends on the time and information available."
  ],
  "donts": [
   "Hiding uncertainty behind confident language."
  ],
  "followUp": "Which assumption is least secure?",
  "exercise": "Propose a test that could disprove your conclusion."
 },
 "reflection": {
  "dimension": "learning",
  "label": "Reflection and learning",
  "description": "Looks for a concrete review of the experience.",
  "anchors": [
   "Identifies no learning from what happened.",
   "States a general lesson without connecting it to an action.",
   "Explains what was learned and what would be done differently.",
   "Connects the learning to an implemented change and acknowledges its limitations."
  ],
  "dos": [
   "Explain a concrete change."
  ],
  "depends": [
   "A failure can provide strong evidence."
  ],
  "donts": [
   "Turning every difficulty into a fictional success."
  ],
  "followUp": "What would you do differently if the situation happened again?",
  "exercise": "Turn one lesson into an action that can be checked."
 },
 "feedback_iteration": {
  "dimension": "learning",
  "label": "Applying feedback",
  "description": "Requires observed feedback and another attempt; it does not infer humility.",
  "anchors": [
   "Repeats the same answer without addressing relevant feedback.",
   "Acknowledges feedback but changes aspects unrelated to the problem.",
   "Applies a change that addresses the feedback.",
   "Applies the change, explains its usefulness and evaluates what remains unresolved."
  ],
  "dos": [
   "Try a specific change and review it."
  ],
  "depends": [
   "You can disagree with feedback when you explain your reasons."
  ],
  "donts": [
   "Confusing agreement with learning."
  ],
  "followUp": "What will you change on your next attempt?",
  "exercise": "Repeat the answer while applying one concrete suggestion.",
  "measurement": "interaction"
 },
 "clear_structure": {
  "dimension": "communication",
  "label": "Clarity and structure",
  "description": "Assesses whether the idea can be followed, not accent, personality or speed.",
  "anchors": [
   "The sequence makes the main idea impossible to identify.",
   "The idea appears but gets lost among unrelated details.",
   "Presents a main idea in an understandable sequence.",
   "Organizes and summarizes without leaving out necessary information."
  ],
  "dos": [
   "State the main idea and connect its parts."
  ],
  "depends": [
   "STAR helps with behavioral examples, but not every answer."
  ],
  "donts": [
   "Penalizing accent, pauses or filler words on their own."
  ],
  "followUp": "What main idea should the listener remember?",
  "exercise": "Repeat the answer with an opening, development and conclusion."
 },
 "audience_adaptation": {
  "dimension": "communication",
  "label": "Audience adaptation",
  "description": "Assesses the choice of explanations against the audience’s stated knowledge and objective.",
  "anchors": [
   "Uses terms the specified listener cannot interpret.",
   "Clarifies some terms but omits essential ones.",
   "Adjusts language and detail to the specified audience.",
   "Chooses a relevant explanation and offers a way to check understanding."
  ],
  "dos": [
   "Explain necessary terms."
  ],
  "depends": [
   "An expert audience may require technical precision."
  ],
  "donts": [
   "Confusing simplification with hiding limitations."
  ],
  "followUp": "How would you explain this to someone without your background?",
  "exercise": "Explain the same idea to a colleague and to a user."
 },
 "active_listening": {
  "dimension": "communication",
  "label": "Demonstrated listening",
  "description": "Can only be assessed with another person’s turns, not from a monologue.",
  "anchors": [
   "Ignores central information from the other person.",
   "Recalls part of the information but distorts a relevant condition.",
   "Accurately summarizes what was heard and responds to it.",
   "Clarifies ambiguities and adjusts the response to new information."
  ],
  "dos": [
   "Confirm your understanding before moving forward."
  ],
  "depends": [
   "Not every answer requires another question."
  ],
  "donts": [
   "Using speaking-time ratios as automatic proof of listening."
  ],
  "followUp": "What have you just learned that changes your response?",
  "exercise": "Summarize the other person’s request and ask a useful clarifying question.",
  "measurement": "interaction"
 },
 "sales_discovery": {
  "dimension": "role_skill",
  "label": "Sales discovery",
  "description": "An editorial interpretation: assess needs and usefulness, not talkativeness.",
  "anchors": [
   "Offers a product without exploring the need.",
   "Asks about a need without clarifying its impact or constraints.",
   "Explores the relevant need, impact and constraints.",
   "Prioritizes needs and checks whether the proposal fits before moving forward."
  ],
  "dos": [
   "Connect questions to sales decisions."
  ],
  "depends": [
   "Discovery and pitching require different behaviors."
  ],
  "donts": [
   "Listing features without explaining their value to the customer."
  ],
  "followUp": "What confirmed need does your proposal address?",
  "exercise": "Simulate discovery with a customer who changes a constraint.",
  "measurement": "interaction"
 },
 "sales_objection": {
  "dimension": "role_skill",
  "label": "Objections and value proposition",
  "description": "Assesses the response to a specific concern.",
  "anchors": [
   "Rebuts a different objection from the one raised.",
   "Acknowledges the objection but responds with a generic promise.",
   "Clarifies the concern and proposes a response connected to it.",
   "Checks the usefulness of the response and agrees on a realistic next step."
  ],
  "dos": [
   "Clarify before responding."
  ],
  "depends": [
   "An objection may reveal that there is no fit."
  ],
  "donts": [
   "Promising unsupported results."
  ],
  "followUp": "What exact concern are you addressing?",
  "exercise": "Respond to an objection and check whether it has been resolved.",
  "measurement": "interaction"
 },
 "quant_derivation": {
  "dimension": "role_skill",
  "label": "Quantitative derivation",
  "description": "Mathematical correctness requires a sample reviewed by a specialist.",
  "anchors": [
   "The approach contains an error that invalidates the solution.",
   "Introduces useful elements but leaves a decisive step unjustified.",
   "Derives a correct solution under explicit assumptions.",
   "Checks the derivation using boundary cases or an independent method."
  ],
  "dos": [
   "Show assumptions and steps that can be checked."
  ],
  "depends": [
   "Expectations depend on the mathematical level of the role."
  ],
  "donts": [
   "Treating a correct number as sufficient proof of the method."
  ],
  "followUp": "How would you check your result?",
  "exercise": "Solve a problem and check it using an independent method.",
  "measurement": "work_sample",
  "expert": true
 },
 "quant_validation": {
  "dimension": "role_skill",
  "label": "Model validation",
  "description": "Statistical validity cannot be inferred from the quality of the explanation.",
  "anchors": [
   "Proposes evaluation data that invalidate the check.",
   "Mentions validation without controlling a central source of bias.",
   "Separates fitting from evaluation and acknowledges relevant assumptions.",
   "Examines sensitivity, information leakage and limits to generalization."
  ],
  "dos": [
   "Distinguish evidence from fitting and from evaluation."
  ],
  "depends": [
   "The method depends on the data and objective."
  ],
  "donts": [
   "Presenting past performance as a guarantee."
  ],
  "followUp": "What could artificially inflate this evaluation?",
  "exercise": "Review an experiment with possible information leakage.",
  "measurement": "work_sample",
  "expert": true
 },
 "software_correctness": {
  "dimension": "role_skill",
  "label": "Code correctness",
  "description": "Requires code or execution results that can be reviewed.",
  "anchors": [
   "The solution fails the central case.",
   "Meets part of the task but fails a relevant condition.",
   "Meets the requirements and checks representative cases.",
   "Adds boundary checks and explains remaining failures or limitations."
  ],
  "dos": [
   "Check behavior using specific inputs."
  ],
  "depends": [
   "Available tools and time depend on the exercise."
  ],
  "donts": [
   "Confusing a fluent explanation with correct code."
  ],
  "followUp": "What input could break this solution?",
  "exercise": "Implement a solution and test its boundaries.",
  "measurement": "work_sample",
  "expert": true
 },
 "software_design": {
  "dimension": "role_skill",
  "label": "System design and reliability",
  "description": "Assesses technical decisions in a work sample, not how convincing a diagram looks.",
  "anchors": [
   "The design omits an essential operational requirement.",
   "Covers the main flow without addressing a relevant failure.",
   "Connects components to requirements and considers plausible failures.",
   "Compares alternatives and verifies relevant capacity, recovery and limitations."
  ],
  "dos": [
   "Connect decisions to requirements and failures."
  ],
  "depends": [
   "Scale and criticality change the solution."
  ],
  "donts": [
   "Adding complexity without a demonstrated need."
  ],
  "followUp": "What happens when this component fails?",
  "exercise": "Design a flow and describe how it recovers from a failure.",
  "measurement": "work_sample",
  "expert": true
 },
 "design_evidence": {
  "dimension": "role_skill",
  "label": "Evidence of user needs",
  "description": "Assesses the traceability of design decisions.",
  "anchors": [
   "Decides based only on personal preferences.",
   "Mentions users without evidence connecting them to the decision.",
   "Connects a documented need to a decision.",
   "Compares evidence, identifies limitations and revises the decision when findings contradict it."
  ],
  "dos": [
   "Separate observations from interpretations."
  ],
  "depends": [
   "A student project can use limited, explicitly described evidence."
  ],
  "donts": [
   "Inventing research or testimonials."
  ],
  "followUp": "What observation changed your design?",
  "exercise": "Trace a decision from evidence to proposal."
 },
 "design_evaluation": {
  "dimension": "role_skill",
  "label": "Evaluating the design solution",
  "description": "Requires an artifact and relevant criteria; an explanation alone does not certify accessibility.",
  "anchors": [
   "The proposal does not allow the central task to be completed.",
   "Allows part of the task but does not check an important obstacle.",
   "Checks relevant tasks and barriers using an explicit method.",
   "Uses findings to iterate and checks the task and its limitations again."
  ],
  "dos": [
   "Evaluate specific tasks."
  ],
  "depends": [
   "The method and fidelity depend on the stage."
  ],
  "donts": [
   "Confusing visual appeal with usability or accessibility."
  ],
  "followUp": "How do you know the task can be completed?",
  "exercise": "Test a task in the prototype and document one improvement.",
  "measurement": "work_sample",
  "expert": true
 },
 "marketing_positioning": {
  "dimension": "role_skill",
  "label": "Audience and marketing proposition",
  "description": "An editorial interpretation of the AMA framework.",
  "anchors": [
   "Defines an audience so broad that it does not guide the proposition.",
   "Names a segment without connecting its need to the message.",
   "Connects the audience, need and proposition using available evidence.",
   "Distinguishes the proposition and its limitations and explains what signal would prompt a revision."
  ],
  "dos": [
   "Connect the audience, need and message."
  ],
  "depends": [
   "The market and channel change the level of detail required."
  ],
  "donts": [
   "Attributing preferences to a group without evidence."
  ],
  "followUp": "What evidence supports that need?",
  "exercise": "Formulate a proposition for a clearly defined segment."
 },
 "marketing_measurement": {
  "dimension": "role_skill",
  "label": "Marketing measurement",
  "description": "Requires review of metrics and the evaluation design.",
  "anchors": [
   "Chooses a metric that does not address the objective.",
   "Chooses a relevant metric without a comparison baseline.",
   "Defines an objective, metric and comparison that can be interpreted.",
   "Examines bias, costs and attribution limitations before recommending an action."
  ],
  "dos": [
   "Define what decision the measurement will change."
  ],
  "depends": [
   "Causal claims require a suitable design."
  ],
  "donts": [
   "Treating correlation or reach as demonstrated impact."
  ],
  "followUp": "What other explanation could account for that change?",
  "exercise": "Design an evaluation and state its causal limitations.",
  "measurement": "work_sample",
  "expert": true
 },
 "cyber_threat_model": {
  "dimension": "role_skill",
  "label": "Threats and prioritization",
  "description": "An editorial interpretation of NICE tasks; technical review is required.",
  "anchors": [
   "Proposes controls without identifying assets or threats.",
   "Identifies a threat without considering exposure or impact.",
   "Connects assets, threats, exposure and relevant controls.",
   "Prioritizes risks and explains uncertainties and residual risk."
  ],
  "dos": [
   "Specify assets and the authorized scope."
  ],
  "depends": [
   "Threats depend on the system and role."
  ],
  "donts": [
   "Claiming complete security after adding controls."
  ],
  "followUp": "What risk remains after the control?",
  "exercise": "Build a threat model for a fictional system.",
  "measurement": "work_sample",
  "expert": true
 },
 "cyber_response": {
  "dimension": "role_skill",
  "label": "Incident response",
  "description": "Assesses a defensive exercise that can be reviewed.",
  "anchors": [
   "Acts without defining the incident and compromises evidence or scope.",
   "Proposes containment without a plan for verification or coordination.",
   "Sequences verification, containment and communication to suit the case.",
   "Justifies priorities, preserves relevant evidence and plans recovery and learning."
  ],
  "dos": [
   "Distinguish suspicion from confirmed facts."
  ],
  "depends": [
   "Responsibilities and protocols vary."
  ],
  "donts": [
   "Taking actions outside the authorized scope."
  ],
  "followUp": "What would you verify before containment?",
  "exercise": "Explain a defensive response to a simulated incident.",
  "measurement": "work_sample",
  "expert": true
 },
 "consulting_case": {
  "dimension": "role_skill",
  "label": "Case analysis",
  "description": "Checking the correctness of a quantitative analysis requires a work sample.",
  "anchors": [
   "The analysis does not address the client’s decision.",
   "Breaks down part of the problem but omits a decisive factor.",
   "Structures relevant factors and uses the data consistently.",
   "Prioritizes tests, checks calculations and updates the recommendation in response to evidence."
  ],
  "dos": [
   "Connect every analysis to the decision."
  ],
  "depends": [
   "Cases differ by employer and practice."
  ],
  "donts": [
   "Applying a memorized framework even when it does not fit."
  ],
  "followUp": "What analysis would be most valuable for the decision?",
  "exercise": "Solve a short case while making assumptions and checks explicit.",
  "measurement": "work_sample",
  "expert": true
 },
 "consulting_recommendation": {
  "dimension": "role_skill",
  "label": "Client recommendation",
  "description": "Assesses a synthesis that supports a decision, not calculation accuracy.",
  "anchors": [
   "Lists findings without recommending an action.",
   "Recommends an action without sufficient conditions or justification.",
   "States an action, reasons and the main risk.",
   "Prioritizes next steps and explains what conditions would change the recommendation."
  ],
  "dos": [
   "Explain what to do and why."
  ],
  "depends": [
   "The level of detail depends on the decision-maker."
  ],
  "donts": [
   "Hiding assumptions to sound conclusive."
  ],
  "followUp": "What would need to happen for you to change your recommendation?",
  "exercise": "Present a recommendation with a risk and a next step."
 },
 "banking_valuation": {
  "dimension": "role_skill",
  "label": "Financial valuation",
  "description": "An editorial proposal; the banking source provides general preparation, not technical endorsement.",
  "anchors": [
   "The model contains a central methodological or calculation error.",
   "Applies part of the method without justifying decisive inputs.",
   "Applies an appropriate method with assumptions and calculations that can be reviewed.",
   "Checks consistency and sensitivity and explains the valuation’s limitations."
  ],
  "dos": [
   "Show assumptions and checks."
  ],
  "depends": [
   "Methods depend on the asset and mandate."
  ],
  "donts": [
   "Presenting a number as a certain value."
  ],
  "followUp": "Which assumption changes the result most?",
  "exercise": "Build an educational valuation and analyze its sensitivity.",
  "measurement": "work_sample",
  "expert": true
 },
 "banking_transaction": {
  "dimension": "role_skill",
  "label": "Transaction risks",
  "description": "An editorial proposal requiring specialist financial review.",
  "anchors": [
   "Makes a recommendation without considering a decisive risk.",
   "Lists risks without relating them to the transaction.",
   "Connects risks, objectives and the proposed structure.",
   "Compares scenarios and execution conditions and identifies missing information."
  ],
  "dos": [
   "Explain relevant objectives and risks."
  ],
  "depends": [
   "The product and client change the analysis."
  ],
  "donts": [
   "Promising returns or guaranteed execution."
  ],
  "followUp": "What condition would prevent you from recommending the transaction?",
  "exercise": "Analyze scenarios for a fictional transaction.",
  "measurement": "work_sample",
  "expert": true
 },
 "investment_thesis": {
  "dimension": "role_skill",
  "label": "Fundamental investment thesis",
  "description": "An editorial proposal for a fundamental analysis work sample, not an employer rubric or investment advice. Financial correctness requires specialist review.",
  "anchors": [
   "Proposes an investment without connecting the business, evidence and assumed value.",
   "Identifies a business driver but leaves a decisive thesis premise unsupported.",
   "Connects business drivers, evidence, valuation and risks under explicit assumptions.",
   "Compares scenarios and contrary evidence and explains what finding would disprove or change the thesis."
  ],
  "dos": [
   "Distinguish provided facts, assumptions and estimates.",
   "Connect the thesis to business drivers, valuation and risks."
  ],
  "depends": [
   "Model depth depends on the mandate, time and available data.",
   "Choosing not to invest can be a supported conclusion."
  ],
  "donts": [
   "Promising returns or presenting the thesis as a certain fact.",
   "Inventing data, catalysts or results to defend the idea."
  ],
  "followUp": "What contrary evidence would make you abandon or revise the thesis?",
  "exercise": "Present a fictional investment idea with scenarios, risks and a condition that would disprove your thesis.",
  "measurement": "work_sample",
  "expert": true
 },
 "investment_integrity": {
  "dimension": "role_skill",
  "label": "Research integrity and information handling",
  "description": "Assesses stated actions concerning sources, restricted information and limitations; it does not infer character or certify compliance. Review must reflect the applicable policies and responsibilities.",
  "anchors": [
   "Uses information of questionable origin or restricted information without acknowledging the issue.",
   "Recognizes a source limitation but does not propose verification or escalation.",
   "Distinguishes verifiable information, assumptions and restrictions and proposes appropriate review or escalation.",
   "Preserves traceability, explains what must pause or be confirmed and corrects the proposal when the permitted evidence changes."
  ],
  "dos": [
   "Check the source and permission to use information before incorporating it.",
   "Explain uncertainties and seek guidance from the authorized contact when appropriate."
  ],
  "depends": [
   "Policies, permissions and obligations depend on the employer, role and jurisdiction."
  ],
  "donts": [
   "Requesting or disclosing confidential or potentially nonpublic information to complete the practice.",
   "Inventing sources or claiming a compliance review has already taken place."
  ],
  "followUp": "What information must you stop using or confirm before continuing, and whom would you consult?",
  "exercise": "Resolve a synthetic case involving a questionable source, explaining limitations, traceability and escalation.",
  "measurement": "work_sample",
  "expert": true
 },
 "accounting_reconciliation": {
  "dimension": "role_skill",
  "label": "Reconciliation and traceability",
  "description": "Requires records or a work sample that can be reviewed.",
  "anchors": [
   "Accepts incompatible balances without detecting the discrepancy.",
   "Detects differences without tracing their origin.",
   "Reconciles differences using evidence and a justified treatment.",
   "Documents checks, resolves discrepancies and identifies outstanding items."
  ],
  "dos": [
   "Preserve the traceability of adjustments."
  ],
  "depends": [
   "Standards and materiality depend on the engagement."
  ],
  "donts": [
   "Adjusting figures merely to make them balance."
  ],
  "followUp": "What evidence supports that adjustment?",
  "exercise": "Reconcile synthetic records and document the differences.",
  "measurement": "work_sample",
  "expert": true
 },
 "accounting_controls": {
  "dimension": "role_skill",
  "label": "Controls and evidence",
  "description": "Assesses controls and evidence for a specific task.",
  "anchors": [
   "Concludes that a control exists without relevant evidence.",
   "Describes the control without checking how it operates.",
   "Connects the risk, control and evidence of operation.",
   "Identifies limitations of the test and proposes a response to exceptions."
  ],
  "dos": [
   "Distinguish control design from operation."
  ],
  "depends": [
   "The scope and level of evidence depend on the work."
  ],
  "donts": [
   "Concluding that there is no risk because no exceptions were found."
  ],
  "followUp": "What does that test actually demonstrate?",
  "exercise": "Design a control check with explicit limitations.",
  "measurement": "work_sample",
  "expert": true
 },
 "legal_analysis": {
  "dimension": "role_skill",
  "label": "Legal analysis in context",
  "description": "Requires legal review appropriate to the jurisdiction and date.",
  "anchors": [
   "Applies a rule unrelated to the problem or jurisdiction.",
   "Identifies a relevant issue without supporting the applicable rule.",
   "Connects facts, verified rules and a bounded conclusion.",
   "Analyzes alternative interpretations, missing facts and limitations of the conclusion."
  ],
  "dos": [
   "State the jurisdiction and relevant facts."
  ],
  "depends": [
   "The standard depends on the role and matter."
  ],
  "donts": [
   "Inventing precedents or expressing unsupported certainty."
  ],
  "followUp": "What fact or authority would change your conclusion?",
  "exercise": "Analyze a fictional scenario using references that can be checked.",
  "measurement": "work_sample",
  "expert": true
 },
 "legal_client_options": {
  "dimension": "role_skill",
  "label": "Legal options and communication",
  "description": "A work sample for review; this is not advice for an actual case.",
  "anchors": [
   "Recommends an action without considering the client’s objective.",
   "Presents an option without explaining relevant risks.",
   "Explains options, risks and steps in relation to the stated objective.",
   "Distinguishes the engagement’s limits and obtains necessary clarification before recommending an action."
  ],
  "dos": [
   "Connect options to the client’s objectives."
  ],
  "depends": [
   "Authority and obligations vary by jurisdiction."
  ],
  "donts": [
   "Promising a legal outcome."
  ],
  "followUp": "What does the client need to decide, and what information is needed?",
  "exercise": "Write out options for an academic case.",
  "measurement": "work_sample",
  "expert": true
 },
 "manufacturing_diagnosis": {
  "dimension": "role_skill",
  "label": "Diagnosing process failures",
  "description": "An editorial proposal requiring a work sample and technical review.",
  "anchors": [
   "Intervenes without checking the symptom or safe conditions.",
   "Proposes a cause without a test that distinguishes it from alternatives.",
   "Orders safe checks to distinguish plausible causes.",
   "Confirms the cause, verifies the correction and documents limitations and prevention."
  ],
  "dos": [
   "Check before intervening."
  ],
  "depends": [
   "Procedures depend on the equipment and authorization."
  ],
  "donts": [
   "Skipping safety measures to work faster."
  ],
  "followUp": "What test would distinguish the two leading causes?",
  "exercise": "Diagnose a simulated failure using a decision tree of checks.",
  "measurement": "work_sample",
  "expert": true
 },
 "manufacturing_quality": {
  "dimension": "role_skill",
  "label": "Process quality and improvement",
  "description": "Assesses a process analysis that can be reviewed.",
  "anchors": [
   "Proposes improvement without defining the defect or measure.",
   "Defines a measure without a comparable reference point.",
   "Connects the defect, data and improvement action.",
   "Verifies the effect, variation and unintended consequences before standardizing."
  ],
  "dos": [
   "Define what counts as an improvement."
  ],
  "depends": [
   "Tolerances and controls depend on the process."
  ],
  "donts": [
   "Confusing an isolated observation with sustained improvement."
  ],
  "followUp": "How would you check that the improvement lasts?",
  "exercise": "Design a before-and-after check with stated limitations.",
  "measurement": "work_sample",
  "expert": true
 },
 "aerospace_verification": {
  "dimension": "role_skill",
  "label": "Requirements and technical verification",
  "description": "An editorial criterion; the Boeing guide does not certify engineering work or compliance.",
  "anchors": [
   "Proposes a solution without a verifiable requirement.",
   "Connects a solution to a requirement without defining how to test it.",
   "Traces the requirement, design and test using explicit conditions.",
   "Examines coverage, test limitations and the evidence needed to accept the result."
  ],
  "dos": [
   "Trace the connection between the requirement and test."
  ],
  "depends": [
   "Regulations and criticality depend on the system."
  ],
  "donts": [
   "Equating simulation with certification."
  ],
  "followUp": "What evidence would support acceptance of that requirement?",
  "exercise": "Trace a fictional requirement through to its test.",
  "measurement": "work_sample",
  "expert": true
 },
 "aerospace_safety": {
  "dimension": "role_skill",
  "label": "Risk and engineering changes",
  "description": "An editorial proposal pending specialist review.",
  "anchors": [
   "Proposes a change without identifying its safety impact.",
   "Identifies a hazard without analyzing conditions or controls.",
   "Connects the hazard, consequences and mitigation measures.",
   "Analyzes the change’s impact, residual risk and outstanding verification."
  ],
  "dos": [
   "State the limitations of safety evidence."
  ],
  "depends": [
   "The level of analysis depends on the system and function."
  ],
  "donts": [
   "Claiming that there is no risk because no incidents have occurred."
  ],
  "followUp": "What needs to be verified again after that change?",
  "exercise": "Evaluate the effects of a fictional technical change.",
  "measurement": "work_sample",
  "expert": true
 },
 "research_design": {
  "dimension": "role_skill",
  "label": "Research design",
  "description": "Requires a design that can be reviewed within the discipline.",
  "anchors": [
   "The method cannot answer the question.",
   "The method addresses part of the question but omits a central source of bias.",
   "Connects the question, data and method and identifies limitations.",
   "Compares designs, anticipates bias and establishes reproducible checks."
  ],
  "dos": [
   "Connect the question to the method."
  ],
  "depends": [
   "The discipline and resources determine which designs are feasible."
  ],
  "donts": [
   "Choosing a familiar method without justifying it."
  ],
  "followUp": "What result would disprove your hypothesis?",
  "exercise": "Design a study with one limitation and a way to mitigate it.",
  "measurement": "work_sample",
  "expert": true
 },
 "research_inference": {
  "dimension": "role_skill",
  "label": "Interpretation and reproducibility",
  "description": "Assesses an inference using data or materials that can be reviewed.",
  "anchors": [
   "The conclusion contradicts or exceeds the evidence.",
   "Describes results without addressing a decisive limitation.",
   "Defines the boundaries of conclusions and documents how they were reached.",
   "Compares explanations and allows the steps, available data and limitations to be reviewed."
  ],
  "dos": [
   "Separate results from interpretation."
  ],
  "depends": [
   "Privacy may limit access to data."
  ],
  "donts": [
   "Hiding contradictory results or overstating generalizability."
  ],
  "followUp": "What conclusion do these data not support?",
  "exercise": "Review a conclusion and document how to reproduce it.",
  "measurement": "work_sample",
  "expert": true
 },
 "healthcare_safety": {
  "dimension": "role_skill",
  "label": "Clinical safety and scope",
  "description": "Only for a reviewed educational scenario; it does not establish clinical competence.",
  "anchors": [
   "Proposes action outside the role’s competence or ignores a central risk.",
   "Recognizes a risk without an appropriate response or referral.",
   "Identifies limits and proposes actions and escalation appropriate to the role.",
   "Prioritizes risks, justifies coordination and explains what information needs checking."
  ],
  "dos": [
   "Recognize limits and request appropriate help."
  ],
  "depends": [
   "The scope depends on the profession and jurisdiction."
  ],
  "donts": [
   "Presenting apparent confidence as clinical competence."
  ],
  "followUp": "What requires help or referral in this case?",
  "exercise": "Analyze an academic scenario under specialist review.",
  "measurement": "work_sample",
  "expert": true
 },
 "healthcare_handover": {
  "dimension": "role_skill",
  "label": "Clinical handover",
  "description": "Requires a work sample; oral clarity does not verify clinical content.",
  "anchors": [
   "Omits information critical to continuity of care.",
   "Includes central information but leaves the outstanding action unclear.",
   "Communicates the situation, relevant information and outstanding actions.",
   "Prioritizes risks, distinguishes uncertainties and clarifies responsibility and confirmation."
  ],
  "dos": [
   "Distinguish facts from information awaiting confirmation."
  ],
  "depends": [
   "The format depends on the professional setting."
  ],
  "donts": [
   "Sharing unnecessary real clinical information."
  ],
  "followUp": "What does the next person providing care need to know?",
  "exercise": "Prepare a handover for a synthetic case.",
  "measurement": "work_sample",
  "expert": true
 },
 "education_lesson": {
  "dimension": "role_skill",
  "label": "Teaching objective and design",
  "description": "Requires a lesson sample appropriate to the professional level.",
  "anchors": [
   "The activity has no identifiable learning objective.",
   "Names an objective but the activity does not enable learners to achieve it.",
   "Aligns the objective, explanation and activity with the defined group.",
   "Anticipates difficulties and adjusts the sequence and support while retaining the objective."
  ],
  "dos": [
   "Define what the student will be able to do."
  ],
  "depends": [
   "Age, subject and needs change the design."
  ],
  "donts": [
   "Confusing entertainment with learning."
  ],
  "followUp": "What task would demonstrate that the objective was achieved?",
  "exercise": "Design a short lesson with an objective and a check.",
  "measurement": "work_sample",
  "expert": true
 },
 "education_check": {
  "dimension": "role_skill",
  "label": "Checking and adapting learning",
  "description": "Requires observable responses from the simulated student.",
  "anchors": [
   "Continues despite a clear sign of misunderstanding.",
   "Asks whether students understood without checking the content.",
   "Checks a specific understanding and responds to the observed error.",
   "Adapts the explanation or task and checks learning again."
  ],
  "dos": [
   "Check understanding with a relevant task."
  ],
  "depends": [
   "Not every difficulty requires the same support."
  ],
  "donts": [
   "Claiming learning without observing a response."
  ],
  "followUp": "What did the student’s answer show you?",
  "exercise": "Explain a concept and adapt your response to a simulated error.",
  "measurement": "interaction"
 },
 "hospitality_recovery": {
  "dimension": "role_skill",
  "label": "Complaint resolution and follow-up",
  "description": "Assesses a simulated exchange, not perceived likability.",
  "anchors": [
   "Ignores the expressed need or promises something impossible.",
   "Acknowledges the problem without offering a feasible next step.",
   "Clarifies the request and offers a solution or escalation within the role’s authority.",
   "Confirms the next step, coordinates and checks whether the need has been addressed."
  ],
  "dos": [
   "Explain options and limits clearly."
  ],
  "depends": [
   "Authority depends on the role and policy."
  ],
  "donts": [
   "Transferring a complaint without context or a next step."
  ],
  "followUp": "What can you resolve, and what must you escalate?",
  "exercise": "Respond to a complaint with explicit limits on your authority.",
  "measurement": "interaction"
 },
 "hospitality_accuracy": {
  "dimension": "role_skill",
  "label": "Operational service accuracy",
  "description": "Requires review of a record or task; friendliness does not establish accuracy.",
  "anchors": [
   "The record or calculation prevents delivery of the agreed service.",
   "Completes part of the task but leaves a relevant discrepancy.",
   "Records and checks relevant information, charges or requests.",
   "Detects discrepancies, resolves them with traceability and coordinates necessary changes."
  ],
  "dos": [
   "Check details that affect the service."
  ],
  "depends": [
   "Systems and policies vary by establishment."
  ],
  "donts": [
   "Inventing confirmations or availability."
  ],
  "followUp": "What information must you confirm before making that promise?",
  "exercise": "Review a synthetic reservation and charges containing a discrepancy.",
  "measurement": "work_sample",
  "expert": true
 },
 "policy_options": {
  "dimension": "role_skill",
  "label": "Public policy options and evidence",
  "description": "Requires a work sample and review of data and assumptions.",
  "anchors": [
   "Proposes a measure without connecting the problem and evidence.",
   "Connects an option to the problem without comparing relevant effects.",
   "Compares options using relevant evidence, costs and effects.",
   "Analyzes the distribution of effects, uncertainty and implementation conditions."
  ],
  "dos": [
   "Distinguish evidence, values and policy choices."
  ],
  "depends": [
   "Jurisdiction and mandate define the available options."
  ],
  "donts": [
   "Presenting political preferences as technical truth."
  ],
  "followUp": "Who bears the costs, and who receives the benefits?",
  "exercise": "Compare two options using evidence and explicit limitations.",
  "measurement": "work_sample",
  "expert": true
 },
 "policy_implementation": {
  "dimension": "role_skill",
  "label": "Implementation and stakeholders",
  "description": "Assesses an explained plan; it does not infer political orientation.",
  "anchors": [
   "The proposal does not identify responsible parties or steps.",
   "Lists stakeholders without clarifying responsibilities or dependencies.",
   "Defines responsibilities, steps and monitoring indicators.",
   "Anticipates disagreements, dependencies and mechanisms for reviewing execution."
  ],
  "dos": [
   "Explain who can carry out each step."
  ],
  "depends": [
   "Participation and authority depend on the mandate."
  ],
  "donts": [
   "Confusing assumed support with a confirmed agreement."
  ],
  "followUp": "What dependency could block implementation?",
  "exercise": "Explain a plan with responsible parties, a dependency and follow-up."
 }
} as const satisfies Record<string, Criterion>;

export const PROFILES = {
 "generic": {
  "label": "General interview",
  "criteria": [
   "answer_focus",
   "context",
   "ownership",
   "outcomes",
   "problem_framing",
   "decision_tradeoffs",
   "uncertainty",
   "reflection",
   "feedback_iteration",
   "clear_structure",
   "audience_adaptation",
   "active_listening"
  ],
  "weights": {
   "relevance": 20,
   "evidence": 20,
   "reasoning": 20,
   "role_skill": 0,
   "learning": 20,
   "communication": 20
  }
 },
 "sales": {
  "label": "Consultative sales",
  "criteria": [
   "answer_focus",
   "context",
   "ownership",
   "outcomes",
   "problem_framing",
   "decision_tradeoffs",
   "reflection",
   "clear_structure",
   "audience_adaptation",
   "active_listening",
   "feedback_iteration",
   "sales_discovery",
   "sales_objection"
  ],
  "weights": {
   "relevance": 10,
   "evidence": 15,
   "reasoning": 15,
   "role_skill": 20,
   "learning": 10,
   "communication": 30
  }
 },
 "quant": {
  "label": "Quantitative roles and research",
  "criteria": [
   "answer_focus",
   "context",
   "ownership",
   "outcomes",
   "problem_framing",
   "decision_tradeoffs",
   "reflection",
   "clear_structure",
   "uncertainty",
   "feedback_iteration",
   "quant_derivation",
   "quant_validation"
  ],
  "weights": {
   "relevance": 5,
   "evidence": 10,
   "reasoning": 30,
   "role_skill": 30,
   "learning": 10,
   "communication": 15
  }
 },
 "software": {
  "label": "Software engineering",
  "criteria": [
   "answer_focus",
   "context",
   "ownership",
   "outcomes",
   "problem_framing",
   "decision_tradeoffs",
   "reflection",
   "clear_structure",
   "audience_adaptation",
   "software_correctness",
   "software_design"
  ],
  "weights": {
   "relevance": 16.67,
   "evidence": 16.67,
   "reasoning": 16.67,
   "role_skill": 16.67,
   "learning": 16.67,
   "communication": 16.67
  }
 },
 "design": {
  "label": "Product design",
  "criteria": [
   "answer_focus",
   "context",
   "ownership",
   "outcomes",
   "problem_framing",
   "decision_tradeoffs",
   "reflection",
   "clear_structure",
   "audience_adaptation",
   "design_evidence",
   "design_evaluation"
  ],
  "weights": {
   "relevance": 16.67,
   "evidence": 16.67,
   "reasoning": 16.67,
   "role_skill": 16.67,
   "learning": 16.67,
   "communication": 16.67
  }
 },
 "marketing": {
  "label": "Marketing",
  "criteria": [
   "answer_focus",
   "context",
   "ownership",
   "outcomes",
   "problem_framing",
   "decision_tradeoffs",
   "reflection",
   "clear_structure",
   "audience_adaptation",
   "marketing_positioning",
   "marketing_measurement"
  ],
  "weights": {
   "relevance": 16.67,
   "evidence": 16.67,
   "reasoning": 16.67,
   "role_skill": 16.67,
   "learning": 16.67,
   "communication": 16.67
  }
 },
 "cybersecurity": {
  "label": "Cybersecurity",
  "criteria": [
   "answer_focus",
   "context",
   "ownership",
   "outcomes",
   "problem_framing",
   "decision_tradeoffs",
   "reflection",
   "clear_structure",
   "audience_adaptation",
   "cyber_threat_model",
   "cyber_response"
  ],
  "weights": {
   "relevance": 16.67,
   "evidence": 16.67,
   "reasoning": 16.67,
   "role_skill": 16.67,
   "learning": 16.67,
   "communication": 16.67
  }
 },
 "consulting": {
  "label": "Consulting",
  "criteria": [
   "answer_focus",
   "context",
   "ownership",
   "outcomes",
   "problem_framing",
   "decision_tradeoffs",
   "reflection",
   "clear_structure",
   "audience_adaptation",
   "active_listening",
   "feedback_iteration",
   "consulting_case",
   "consulting_recommendation"
  ],
  "weights": {
   "relevance": 16.67,
   "evidence": 16.67,
   "reasoning": 16.67,
   "role_skill": 16.67,
   "learning": 16.67,
   "communication": 16.67
  }
 },
 "banking": {
  "label": "Banking and transaction analysis",
  "criteria": [
   "answer_focus",
   "context",
   "ownership",
   "outcomes",
   "problem_framing",
   "decision_tradeoffs",
   "reflection",
   "clear_structure",
   "audience_adaptation",
   "banking_valuation",
   "banking_transaction"
  ],
  "weights": {
   "relevance": 16.67,
   "evidence": 16.67,
   "reasoning": 16.67,
   "role_skill": 16.67,
   "learning": 16.67,
   "communication": 16.67
  }
 },
 "investment_research": {
  "label": "Fundamental investment research",
  "criteria": [
   "answer_focus",
   "context",
   "ownership",
   "outcomes",
   "problem_framing",
   "decision_tradeoffs",
   "reflection",
   "clear_structure",
   "audience_adaptation",
   "uncertainty",
   "banking_valuation",
   "investment_thesis",
   "investment_integrity"
  ],
  "weights": {
   "relevance": 16.67,
   "evidence": 16.67,
   "reasoning": 16.67,
   "role_skill": 16.67,
   "learning": 16.67,
   "communication": 16.67
  }
 },
 "accounting": {
  "label": "Accounting and controls",
  "criteria": [
   "answer_focus",
   "context",
   "ownership",
   "outcomes",
   "problem_framing",
   "decision_tradeoffs",
   "reflection",
   "clear_structure",
   "audience_adaptation",
   "accounting_reconciliation",
   "accounting_controls"
  ],
  "weights": {
   "relevance": 16.67,
   "evidence": 16.67,
   "reasoning": 16.67,
   "role_skill": 16.67,
   "learning": 16.67,
   "communication": 16.67
  }
 },
 "legal": {
  "label": "Legal services",
  "criteria": [
   "answer_focus",
   "context",
   "ownership",
   "outcomes",
   "problem_framing",
   "decision_tradeoffs",
   "reflection",
   "clear_structure",
   "audience_adaptation",
   "legal_analysis",
   "legal_client_options"
  ],
  "weights": {
   "relevance": 16.67,
   "evidence": 16.67,
   "reasoning": 16.67,
   "role_skill": 16.67,
   "learning": 16.67,
   "communication": 16.67
  }
 },
 "manufacturing": {
  "label": "Manufacturing",
  "criteria": [
   "answer_focus",
   "context",
   "ownership",
   "outcomes",
   "problem_framing",
   "decision_tradeoffs",
   "reflection",
   "clear_structure",
   "audience_adaptation",
   "manufacturing_diagnosis",
   "manufacturing_quality"
  ],
  "weights": {
   "relevance": 16.67,
   "evidence": 16.67,
   "reasoning": 16.67,
   "role_skill": 16.67,
   "learning": 16.67,
   "communication": 16.67
  }
 },
 "aerospace": {
  "label": "Aerospace engineering",
  "criteria": [
   "answer_focus",
   "context",
   "ownership",
   "outcomes",
   "problem_framing",
   "decision_tradeoffs",
   "reflection",
   "clear_structure",
   "audience_adaptation",
   "aerospace_verification",
   "aerospace_safety"
  ],
  "weights": {
   "relevance": 16.67,
   "evidence": 16.67,
   "reasoning": 16.67,
   "role_skill": 16.67,
   "learning": 16.67,
   "communication": 16.67
  }
 },
 "research": {
  "label": "Research",
  "criteria": [
   "answer_focus",
   "context",
   "ownership",
   "outcomes",
   "problem_framing",
   "decision_tradeoffs",
   "reflection",
   "clear_structure",
   "audience_adaptation",
   "research_design",
   "research_inference"
  ],
  "weights": {
   "relevance": 16.67,
   "evidence": 16.67,
   "reasoning": 16.67,
   "role_skill": 16.67,
   "learning": 16.67,
   "communication": 16.67
  }
 },
 "healthcare": {
  "label": "Clinical care",
  "criteria": [
   "answer_focus",
   "context",
   "ownership",
   "outcomes",
   "problem_framing",
   "decision_tradeoffs",
   "reflection",
   "clear_structure",
   "audience_adaptation",
   "active_listening",
   "feedback_iteration",
   "healthcare_safety",
   "healthcare_handover"
  ],
  "weights": {
   "relevance": 16.67,
   "evidence": 16.67,
   "reasoning": 16.67,
   "role_skill": 16.67,
   "learning": 16.67,
   "communication": 16.67
  }
 },
 "education": {
  "label": "Teaching",
  "criteria": [
   "answer_focus",
   "context",
   "ownership",
   "outcomes",
   "problem_framing",
   "decision_tradeoffs",
   "reflection",
   "clear_structure",
   "audience_adaptation",
   "active_listening",
   "feedback_iteration",
   "education_lesson",
   "education_check"
  ],
  "weights": {
   "relevance": 16.67,
   "evidence": 16.67,
   "reasoning": 16.67,
   "role_skill": 16.67,
   "learning": 16.67,
   "communication": 16.67
  }
 },
 "hospitality": {
  "label": "Hospitality and customer service",
  "criteria": [
   "answer_focus",
   "context",
   "ownership",
   "outcomes",
   "problem_framing",
   "decision_tradeoffs",
   "reflection",
   "clear_structure",
   "audience_adaptation",
   "active_listening",
   "feedback_iteration",
   "hospitality_recovery",
   "hospitality_accuracy"
  ],
  "weights": {
   "relevance": 16.67,
   "evidence": 16.67,
   "reasoning": 16.67,
   "role_skill": 16.67,
   "learning": 16.67,
   "communication": 16.67
  }
 },
 "public_policy": {
  "label": "Public policy",
  "criteria": [
   "answer_focus",
   "context",
   "ownership",
   "outcomes",
   "problem_framing",
   "decision_tradeoffs",
   "reflection",
   "clear_structure",
   "audience_adaptation",
   "policy_options",
   "policy_implementation"
  ],
  "weights": {
   "relevance": 16.67,
   "evidence": 16.67,
   "reasoning": 16.67,
   "role_skill": 16.67,
   "learning": 16.67,
   "communication": 16.67
  }
 }
} as const satisfies Record<string, Profile>;

export type Dimension = "relevance" | "evidence" | "reasoning" | "role_skill" | "learning" | "communication";
export interface Criterion { dimension: Dimension; label: string; description: string; anchors: readonly string[]; dos: readonly string[]; depends: readonly string[]; donts: readonly string[]; followUp: string; exercise: string; measurement?: "interaction" | "work_sample"; expert?: boolean }
export interface Profile { label: string; criteria: readonly string[]; weights: Readonly<Record<Dimension, number>> }
export type CriterionId = keyof typeof CRITERIA;
export type ProfileId = keyof typeof PROFILES;
