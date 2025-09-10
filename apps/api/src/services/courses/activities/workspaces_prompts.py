GENERATE_GRADING_CRITERIA = """
Generate 4–8 minimal, non-overlapping criteria for any given task (optionally with a reference solution) that together comprehensively cover objective, legality/domain, method, correctness, and all necessary validation, justification, or presentation aspects.

Begin with a concise checklist (3–7 bullets) of the conceptual steps you will take to map the task and, if present, the solution to the required criteria. Do not include implementation-level steps.

- First, identify the task family.
- Each criterion must be labeled with one of the following type values only: interpretation, legality/domain, method, correctness, validation, justification, presentation.
- Each criterion must include these structured fields:
    - id_slug: Short, unique, hyphenated identifier (string).
    - type: A value from the allowed labels above.
    - short: Single-sentence summary (string).
    - detail: Expanded description (string).
    - must_fix: Boolean (true if failure on this criterion invalidates correctness, legality/domain, or any explicitly required method/validation).
    - weight: Float value (weighting instructions below).
    - prereqs: List of id_slug values that are logical prerequisites for this criterion (logical DAG).
    - evidence: Object with subfields:
        - targets (list of strings): End-goals or outcomes relevant for the criterion.
        - methods (list of strings): Techniques or approaches required or expected by the task/solution.
        - forms (list of strings): The structure or representation expected for a valid answer.
- The evidence section may reference only symbols, targets, or method names visible in the task/solution—never explicit answers.
- Weighting guidelines:
    - correctness = 1.0,
    - legality/domain = 0.9,
    - method = 0.8,
    - interpretation = 0.7,
    - validation = 0.6,
    - justification = 0.5,
    - presentation = 0.2.
  Adjust ±0.1 if strongly justified; all weights must remain between 0.2 and 1.2, inclusive, with no exceptions.
- Set must_fix to true for correctness, legality/domain, or any explicitly required method/validation types.
- The prereqs field must accurately specify logical dependencies by referencing other id_slugs.
- Do not include any answers or stepwise solutions in any criteria or evidence fields.
- Always perform a reasoned mapping from the task and, if provided, solution to the criteria—aligning types, weights, evidence, and dependencies according to these rules—before generating your output.
- If any required field is missing, an unsupported label is used, or an invalid data type or weight is given, return a JSON error describing the specific issue. Strictly enforce only the allowed type labels, weights, and required fields.
- Never fabricate information not present in the task/solution. Ensure criteria do not overlap or contradict, and that all logical dependencies are fully expressed via the prereqs field.

After generating criteria, validate that all field names, types, values, type labels, and weights are strictly compliant. If any issue is found, return only a descriptive, explicit JSON error message indicating the specific problem.

## Output Format
Return a single JSON object (no markdown formatting) with a top-level key "criteria" whose value is an array of criteria objects, each with these required fields (example below):

{
  "criteria": [
    {
      "id_slug": "interpret-goal",
      "type": "interpretation",
      "short": "Recognizes goal is to solve the quadratic for x.",
      "detail": "Identifies unknown x and that roots of 2x^2–x–3=0 are required.",
      "must_fix": true,
      "weight": 0.7,
      "prereqs": [],
      "evidence": {
        "targets": ["solve for x"],
        "methods": ["factoring", "quadratic formula"],
        "forms": ["set of roots"]
      }
    }
    // ...additional criteria objects
  ]
}

All field names, types, and values must adhere strictly to this specification. If any field, type label, or value is missing, unsupported, or out of range, return only a clear, explicit JSON error message describing the precise issue.
"""
