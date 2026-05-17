import json
import logging
import re

from services.llm import chat_complete

logger = logging.getLogger(__name__)

_PROMPT_TEMPLATE = """\
You are generating competitive-programming-style test cases for an interview practice tool.

Problem title: {title}

Problem description:
{description}

Generate exactly 5 test cases for this problem. Each test case uses STDIN/STDOUT format
(the user's code reads from stdin and writes to stdout — NOT LeetCode's function-based format).
Also generate starter code in Python and JavaScript that reads from stdin and writes to stdout.

Respond with ONLY valid JSON (no markdown, no explanation) matching this exact schema:
{{
  "test_cases": [
    {{"id": "tc1", "stdin": "...", "expected_stdout": "...", "is_hidden": false}},
    {{"id": "tc2", "stdin": "...", "expected_stdout": "...", "is_hidden": false}},
    {{"id": "tc3", "stdin": "...", "expected_stdout": "...", "is_hidden": false}},
    {{"id": "tc4", "stdin": "...", "expected_stdout": "...", "is_hidden": true}},
    {{"id": "tc5", "stdin": "...", "expected_stdout": "...", "is_hidden": true}}
  ],
  "starter_code": {{
    "python": "# complete this function\\nimport sys\\ndata = sys.stdin.read().split()\\n...",
    "javascript": "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\\\n');\\n..."
  }}
}}

Rules:
- test cases tc1-tc3: is_hidden=false (shown to user)
- test cases tc4-tc5: is_hidden=true (hidden validation)
- stdin format must be self-describing (e.g., first line = n, next line = array, etc.)
- expected_stdout must exactly match what the starter code would produce
- starter code must be a COMPLETE working solution that passes all 5 test cases
"""


async def generate_test_cases(problem: dict) -> dict:
    """Call LLM to generate stdin/stdout test cases and starter code for a problem.

    Returns a dict with keys 'test_cases' and 'starter_code', or {} on failure.
    """
    prompt = _PROMPT_TEMPLATE.format(
        title=problem.get("title", ""),
        description=problem.get("description", ""),
    )
    try:
        raw = await chat_complete(prompt, temperature=0.2, max_tokens=2048)
        # strip markdown code fences if the LLM wraps in ```json ... ```
        raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.MULTILINE)
        raw = re.sub(r"\s*```$", "", raw.strip(), flags=re.MULTILINE)
        data = json.loads(raw)
        if "test_cases" not in data or "starter_code" not in data:
            logger.warning("LLM response missing required keys")
            return {}
        return data
    except Exception as exc:
        logger.error("Failed to generate test cases: %s", exc)
        return {}


async def generate_starter_code(problem: dict) -> dict:
    """Generate stdin/stdout starter code via LLM for python and javascript.

    Returns {"python": "...", "javascript": "..."} or {} on failure.
    """
    prompt = f"""\
You are given a competitive programming problem. Generate minimal stdin/stdout starter code.
The code must read ALL inputs from stdin and print the answer to stdout.

Problem Title: {problem.get("title", "")}
Problem Description:
{problem.get("description", "")}

Return ONLY valid JSON. Use \\n to represent newlines inside string values — do NOT include literal newlines in string values.

{{
  "starter_code": {{
    "python": "import sys\\ndata = sys.stdin.read().split()\\n# TODO: implement",
    "javascript": "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\\\n');\\n// TODO: implement"
  }}
}}
"""
    try:
        raw = await chat_complete(prompt, temperature=0.1, max_tokens=1024)
        cleaned = re.sub(r"```(?:json)?|```", "", raw).strip()
        # Repair common LLM mistake: literal newlines inside JSON string values
        # Replace literal newlines that appear between JSON string quotes with \n
        def _escape_newlines_in_strings(text: str) -> str:
            result = []
            in_string = False
            i = 0
            while i < len(text):
                ch = text[i]
                if ch == '"' and (i == 0 or text[i - 1] != '\\'):
                    in_string = not in_string
                    result.append(ch)
                elif ch == '\n' and in_string:
                    result.append('\\n')
                elif ch == '\r' and in_string:
                    pass  # skip carriage returns inside strings
                else:
                    result.append(ch)
                i += 1
            return ''.join(result)
        cleaned = _escape_newlines_in_strings(cleaned)
        data = json.loads(cleaned)
        starter = data.get("starter_code", {})
        if not isinstance(starter, dict) or not starter:
            return {}
        return starter
    except Exception:
        logger.exception("generate_starter_code failed")
        return {}


def _escape_braces(s: str) -> str:
    return s.replace("{", "{{").replace("}", "}}")


_FULL_PROBLEM_TEMPLATE = """\
You are generating high-quality coding interview test cases for a mock interview platform.

Problem Title: {title}

Problem Description:
{description}

Examples from the problem statement:
{examples_block}

Constraints:
{constraints_block}

Your task: generate EXACTLY 5 stdin/stdout test cases and complete starter code for this problem.

RULES:
- tc1, tc2, tc3 MUST be derived directly from the examples above — use those exact inputs and outputs
- tc4 and tc5 MUST be edge cases: empty input, single element, boundary values from constraints, or tricky cases
- All 5 test cases must use a CONSISTENT stdin format (same number of lines, same types per line)
- expected_stdout must exactly match what a correct solution would print (including brackets, spacing)
- Starter code for each language must read stdin in the SAME format as the test cases use
- The python solution field must be a COMPLETE working solution (not a stub) that passes all 5 test cases
- Do NOT include the solution logic in the starter_code — starter_code is for the user to fill in
- CRITICAL: starter_code must define a named function the user fills in (matching the problem's function name),
  plus a __main__ / main block that reads stdin, calls the function, and prints the result.
  The function body should only contain a stub comment like "# Write your solution here" and a return placeholder.
  Do NOT put stdin parsing inside the function — parsing belongs in __main__ / main only.
- Respond with ONLY valid JSON, no markdown fences, no explanation

Example starter_code pattern for a problem "Search Insert Position" with function searchInsert(nums, target) -> int:
{{
  "python": "import sys\\n\\ndef searchInsert(nums, target):\\n    # Write your solution here\\n    pass\\n\\nif __name__ == \\"__main__\\":\\n    lines = sys.stdin.read().strip().split('\\\\n')\\n    nums = list(map(int, lines[0].strip('[]').split(',')))\\n    target = int(lines[1])\\n    print(searchInsert(nums, target))\\n",
  "javascript": "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\\\n');\\nconst nums = JSON.parse(lines[0]);\\nconst target = parseInt(lines[1]);\\n\\nfunction searchInsert(nums, target) {{\\n    // Write your solution here\\n}}\\n\\nconsole.log(searchInsert(nums, target));\\n"
}}

Required JSON schema:
{{
  "test_cases": [
    {{"id": "tc1", "stdin": "...", "expected_stdout": "...", "is_hidden": false}},
    {{"id": "tc2", "stdin": "...", "expected_stdout": "...", "is_hidden": false}},
    {{"id": "tc3", "stdin": "...", "expected_stdout": "...", "is_hidden": false}},
    {{"id": "tc4", "stdin": "...", "expected_stdout": "...", "is_hidden": true}},
    {{"id": "tc5", "stdin": "...", "expected_stdout": "...", "is_hidden": true}}
  ],
  "solution": {{
    "python": "import sys\\n\\ndef solve(...):\\n    # complete working solution\\n    ...\\n\\nif __name__ == \\"__main__\\":\\n    # parse stdin and call solve(...)\\n    ..."
  }},
  "starter_code": {{
    "python": "import sys\\n\\ndef FUNCTION_NAME(PARAMS):\\n    # Write your solution here\\n    pass\\n\\nif __name__ == \\"__main__\\":\\n    lines = sys.stdin.read().strip().split('\\\\n')\\n    # parse inputs from lines\\n    # print(FUNCTION_NAME(...))\\n",
    "javascript": "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\\\n');\\n// parse inputs from lines\\n\\nfunction FUNCTION_NAME(PARAMS) {{\\n    // Write your solution here\\n}}\\n\\n// console.log(FUNCTION_NAME(...));\\n",
    "java": "import java.util.*;\\nimport java.io.*;\\n\\npublic class Main {{\\n    public static RETURN_TYPE FUNCTION_NAME(PARAMS) {{\\n        // Write your solution here\\n        return DEFAULT;\\n    }}\\n\\n    public static void main(String[] args) throws Exception {{\\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\\n        // parse inputs\\n        // System.out.println(FUNCTION_NAME(...));\\n    }}\\n}}\\n",
    "cpp": "#include <bits/stdc++.h>\\nusing namespace std;\\n\\nRETURN_TYPE FUNCTION_NAME(PARAMS) {{\\n    // Write your solution here\\n    return DEFAULT;\\n}}\\n\\nint main() {{\\n    // parse inputs\\n    // cout << FUNCTION_NAME(...) << endl;\\n    return 0;\\n}}\\n",
    "go": "package main\\n\\nimport (\\n    \\"bufio\\"\\n    \\"fmt\\"\\n    \\"os\\"\\n)\\n\\nfunc FUNCTION_NAME(PARAMS) RETURN_TYPE {{\\n    // Write your solution here\\n    return DEFAULT\\n}}\\n\\nfunc main() {{\\n    reader := bufio.NewReader(os.Stdin)\\n    _ = reader\\n    _ = fmt.Println\\n    // parse inputs and call FUNCTION_NAME(...)\\n}}\\n"
  }}
}}
"""


async def generate_full_problem(problem: dict) -> dict:
    """Generate test cases + starter code for all 5 languages using enriched LLM prompt.

    Args:
        problem: dict with keys title, description, examples (list of dicts), constraints (list of str)

    Returns:
        dict with keys test_cases, starter_code, examples, constraints — or {} on failure.
    """
    examples = problem.get("examples", [])
    constraints = problem.get("constraints", [])

    if examples:
        examples_block = "\n".join(
            f"  Input: {ex['input']}\n  Output: {ex['output']}"
            + (f"\n  Explanation: {ex['explanation']}" if ex.get("explanation") else "")
            for ex in examples
        )
    else:
        examples_block = "  (no examples available — infer from description)"

    constraints_block = "\n".join(f"  - {c}" for c in constraints) if constraints else "  (none listed)"

    prompt = _FULL_PROBLEM_TEMPLATE.format(
        title=problem.get("title", ""),
        description=problem.get("description", ""),
        examples_block=examples_block,
        constraints_block=constraints_block,
    )

    _LANG_DEFAULTS = {
        "python": "import sys\n\ndef solve():\n    # Write your solution here\n    pass\n\nif __name__ == \"__main__\":\n    data = sys.stdin.read().strip()\n    solve()\n",
        "javascript": "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\n\nfunction solve() {\n    // Write your solution here\n}\n\nconsole.log(solve());\n",
        "java": "import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        // Write your solution here\n    }\n}\n",
        "cpp": "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n",
        "go": "package main\n\nimport (\n    \"bufio\"\n    \"fmt\"\n    \"os\"\n)\n\nfunc main() {\n    reader := bufio.NewReader(os.Stdin)\n    _ = reader\n    _ = fmt.Println\n    // Write your solution here\n}\n",
    }

    for attempt in range(2):
        try:
            raw = await chat_complete(prompt, temperature=0.2, max_tokens=3000)
            raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.MULTILINE)
            raw = re.sub(r"\s*```$", "", raw.strip(), flags=re.MULTILINE)
            data = json.loads(raw)

            if "test_cases" not in data or "starter_code" not in data:
                logger.warning("generate_full_problem: missing keys on attempt %d", attempt + 1)
                continue

            test_cases = data["test_cases"]
            if len(test_cases) < 3:
                logger.warning("generate_full_problem: only %d test cases on attempt %d", len(test_cases), attempt + 1)
                continue

            # Fill in any languages the LLM omitted with safe defaults
            starter_code = data["starter_code"]
            for lang, default_code in _LANG_DEFAULTS.items():
                if lang not in starter_code:
                    logger.warning("generate_full_problem: missing language %s, using default", lang)
                    starter_code[lang] = default_code

            # Enforce hidden flags: first 3 visible, rest hidden
            for i, tc in enumerate(test_cases):
                tc["is_hidden"] = i >= 3

            return {
                "test_cases": test_cases,
                "starter_code": starter_code,
                "examples": examples,
                "constraints": constraints,
            }

        except Exception as exc:
            logger.warning("generate_full_problem attempt %d failed: %s", attempt + 1, exc)

    return {}
