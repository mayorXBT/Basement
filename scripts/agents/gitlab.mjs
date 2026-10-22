function required(value, name) {
  if (!value) throw new Error(`${name} is required for GitLab API actions`);
  return value;
}

export class GitLabClient {
  constructor({ apiUrl = process.env.CI_API_V4_URL, projectId = process.env.CI_PROJECT_ID, token = process.env.AUTOPILOT_BOT_TOKEN || process.env.GITLAB_TOKEN || process.env.CI_JOB_TOKEN } = {}) {
    this.apiUrl = apiUrl?.replace(/\/$/, "");
    this.projectId = projectId;
    this.token = token;
    this.jobToken = token && token === process.env.CI_JOB_TOKEN && !process.env.AUTOPILOT_BOT_TOKEN && !process.env.GITLAB_TOKEN;
  }

  get configured() {
    return Boolean(this.apiUrl && this.projectId && this.token);
  }

  async request(pathname, { method = "GET", body, responseType = "json" } = {}) {
    const apiUrl = required(this.apiUrl, "CI_API_V4_URL");
    const token = required(this.token, "AUTOPILOT_BOT_TOKEN or GITLAB_TOKEN");
    const response = await fetch(`${apiUrl}${pathname}`, {
      method,
      headers: {
        [this.jobToken ? "job-token" : "private-token"]: token,
        ...(body === undefined ? {} : { "content-type": "application/json" })
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error(`GitLab API ${method} ${pathname} returned ${response.status}`);
    if (response.status === 204) return null;
    return responseType === "text" ? response.text() : response.json();
  }

  projectPath(suffix) {
    return `/projects/${encodeURIComponent(required(this.projectId, "CI_PROJECT_ID"))}${suffix}`;
  }

  listMergeRequestDiscussions(iid) {
    return this.request(this.projectPath(`/merge_requests/${encodeURIComponent(iid)}/discussions?per_page=100`));
  }

  listMergeRequestVersions(iid) {
    return this.request(this.projectPath(`/merge_requests/${encodeURIComponent(iid)}/versions?per_page=20`));
  }

  createMergeRequestDiscussion(iid, body, position) {
    return this.request(this.projectPath(`/merge_requests/${encodeURIComponent(iid)}/discussions`), { method: "POST", body: { body, position } });
  }

  createMergeRequestNote(iid, body) {
    return this.request(this.projectPath(`/merge_requests/${encodeURIComponent(iid)}/notes`), { method: "POST", body: { body } });
  }

  getMergeRequest(iid) {
    return this.request(this.projectPath(`/merge_requests/${encodeURIComponent(iid)}`));
  }

  updateMergeRequest(iid, body) {
    return this.request(this.projectPath(`/merge_requests/${encodeURIComponent(iid)}`), { method: "PUT", body });
  }

  armMergeRequest(iid, sha) {
    return this.request(this.projectPath(`/merge_requests/${encodeURIComponent(iid)}/merge`), { method: "PUT", body: { auto_merge: true, should_remove_source_branch: true, sha } });
  }

  listPipelineJobs(pipelineId) {
    return this.request(this.projectPath(`/pipelines/${encodeURIComponent(pipelineId)}/jobs?per_page=100&include_retried=true`));
  }

  getJobTrace(jobId) {
    return this.request(this.projectPath(`/jobs/${encodeURIComponent(jobId)}/trace`), { responseType: "text" });
  }

  listCommitMergeRequests(sha) {
    return this.request(this.projectPath(`/repository/commits/${encodeURIComponent(sha)}/merge_requests`));
  }

  createIssueNote(iid, body) {
    return this.request(this.projectPath(`/issues/${encodeURIComponent(iid)}/notes`), { method: "POST", body: { body } });
  }

  listIssueNotes(iid) {
    return this.request(this.projectPath(`/issues/${encodeURIComponent(iid)}/notes?per_page=100`));
  }

  updateIssue(iid, body) {
    return this.request(this.projectPath(`/issues/${encodeURIComponent(iid)}`), { method: "PUT", body });
  }

  listIssues(search) {
    return this.request(this.projectPath(`/issues?scope=all&state=all&per_page=100&search=${encodeURIComponent(search)}`));
  }

  createIssue(body) {
    return this.request(this.projectPath("/issues"), { method: "POST", body });
  }

  replyToMergeRequestDiscussion(iid, discussionId, body) {
    return this.request(this.projectPath(`/merge_requests/${encodeURIComponent(iid)}/discussions/${encodeURIComponent(discussionId)}/notes`), { method: "POST", body: { body } });
  }

  resolveMergeRequestDiscussion(iid, discussionId) {
    return this.request(this.projectPath(`/merge_requests/${encodeURIComponent(iid)}/discussions/${encodeURIComponent(discussionId)}`), { method: "PUT", body: { resolved: true } });
  }
}
