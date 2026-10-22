import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

function block(value, spaces) {
  const indentation = " ".repeat(spaces);
  return String(value).trim().split("\n").map((line) => line ? `${indentation}${line}` : "").join("\n");
}

function prompt(name) {
  return fs.readFileSync(path.join(root, "agents", "prompts", `${name}.md`), "utf8");
}

export function renderConductorFlow() {
  const conductor = block(prompt("conductor"), 8);
  const triage = block(prompt("triage"), 8);
  const builder = block(prompt("builder"), 8);
  return `version: "v1"
environment: ambient
coding_environment: full
components:
  - name: "triage"
    type: AgentComponent
    description: "Plans a labelled issue and stops on anything outside the autopilot contract."
    prompt_id: "triage_prompt"
    inputs:
      - from: "context:project_id"
        as: "project_id"
      - from: "context:goal"
        as: "goal"
      - from: "context:inputs.user_rule"
        as: "agents_md"
        optional: true
    toolset: ["get_issue", "get_work_item", "list_issues", "create_issue_note", "update_issue", "read_file", "list_dir", "grep"]
    ui_log_events: ["on_agent_final_answer", "on_tool_execution_success", "on_tool_execution_failed"]
  - name: "builder"
    type: AgentComponent
    description: "Implements the accepted plan with a test and opens one merge request."
    prompt_id: "builder_prompt"
    inputs:
      - from: "context:project_id"
        as: "project_id"
      - from: "context:goal"
        as: "goal"
      - from: "context:inputs.agent_platform_standard_context.primary_branch"
        as: "primary_branch"
      - from: "context:inputs.user_rule"
        as: "agents_md"
        optional: true
    toolset: ["read_file", "list_dir", "find_files", "grep", "edit_file", "create_file_with_contents", "run_command", "create_merge_request", "create_merge_request_note", "get_issue"]
    ui_log_events: ["on_agent_final_answer", "on_tool_execution_success", "on_tool_execution_failed"]
  - name: "conductor"
    type: AgentComponent
    description: "Delegates planning and implementation, enforcing the stop conditions."
    prompt_id: "conductor_prompt"
    inputs:
      - from: "context:project_id"
        as: "project_id"
      - from: "context:goal"
        as: "goal"
    subagents:
      - name: "triage"
      - name: "builder"
    max_delegations: 6
    toolset: ["get_issue"]
    ui_log_events: ["on_agent_final_answer", "on_tool_execution_success", "on_tool_execution_failed"]
prompts:
  - prompt_id: "conductor_prompt"
    unit_primitives: []
    prompt_template:
      system: |-
${conductor}
      user: |-
        Project ID: {{ project_id }}
        Trigger context: {{ goal }}
      placeholder: history
    params:
      timeout: 900
  - prompt_id: "triage_prompt"
    unit_primitives: []
    prompt_template:
      system: |-
${triage}
      user: |-
        Project ID: {{ project_id }}
        Issue trigger context: {{ goal }}
        Shared rules, when supplied: {{ agents_md }}
      placeholder: history
    params:
      timeout: 600
  - prompt_id: "builder_prompt"
    unit_primitives: []
    prompt_template:
      system: |-
${builder}
      user: |-
        Project ID: {{ project_id }}
        Issue and Triage context: {{ goal }}
        Default branch: {{ primary_branch }}
        Shared rules, when supplied: {{ agents_md }}
      placeholder: history
    params:
      timeout: 1200
routers:
  - from: "conductor"
    to: "end"
flow:
  entry_point: "conductor"
  inputs:
    - category: agent_platform_standard_context
      input_schema:
        primary_branch: { type: string, description: "Default branch" }
        workload_branch: { type: string, description: "Workload ref" }
        session_owner_id: { type: string, description: "Human who triggered the flow" }
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rendered = renderConductorFlow();
  if (process.argv.includes("--stdout")) process.stdout.write(rendered);
  else {
    const output = path.join(root, ".gitlab", "duo", "flows", "conductor.yaml");
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, rendered);
    console.log(path.relative(root, output));
  }
}
