function required(value, name) {
  if (!value) throw new Error(`${name} is required for GitLab API actions`);
  return value;
}

export class GitLabClient {
  constructor({ apiUrl = process.env.CI_API_V4_URL, projectId = process.env.CI_PROJECT_ID, token = process.env.AUTOPILOT_BOT_TOKEN || process.env.GITLAB_TOKEN } = {}) {
    this.apiUrl = apiUrl?.replace(/\/$/, "");
    this.projectId = projectId;
    this.token = token;
  }

  get configured() {
    return Boolean(this.apiUrl && this.projectId && this.token);
  }

  async request(pathname, { method = "GET", body } = {}) {
    const apiUrl = required(this.apiUrl, "CI_API_V4_URL");
    const token = required(this.token, "AUTOPILOT_BOT_TOKEN or GITLAB_TOKEN");
    const response = await fetch(`${apiUrl}${pathname}`, {
      method,
      headers: {
        "private-token": token,
        ...(body === undefined ? {} : { "content-type": "application/json" })
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error(`GitLab API ${method} ${pathname} returned ${response.status}`);
    if (response.status === 204) return null;
    return response.json();
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

  replyToMergeRequestDiscussion(iid, discussionId, body) {
    return this.request(this.projectPath(`/merge_requests/${encodeURIComponent(iid)}/discussions/${encodeURIComponent(discussionId)}/notes`), { method: "POST", body: { body } });
  }

  resolveMergeRequestDiscussion(iid, discussionId) {
    return this.request(this.projectPath(`/merge_requests/${encodeURIComponent(iid)}/discussions/${encodeURIComponent(discussionId)}`), { method: "PUT", body: { resolved: true } });
  }
}
