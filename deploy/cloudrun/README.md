# Cloud Run deployment

The repository contains a private-by-default Cloud Run path for `europe-west1`. The CI jobs are manual because enabling billing, creating cloud resources, and exposing a service publicly require the owner's explicit approval. Nothing in this guide has been run against a Google Cloud project yet.

## Cost gate

Stop before the commands below until the owner approves billing. The configuration uses zero minimum instances, one vCPU, 512 MiB memory, and at most two instances. Expected hackathon traffic should be very small and may fit within Google Cloud's current free usage allowances, but billing must still be attached and a $0 result is not guaranteed. Artifact Registry storage, Secret Manager versions/access, network egress, and Cloud Run compute can all become billable. Set a budget alert before creating resources and confirm current prices in the [Google Cloud pricing calculator](https://cloud.google.com/products/calculator).

The intended approval request is: enable the listed APIs; create one Docker repository, two service accounts, one WIF pool/provider, three secrets, and two scale-to-zero Cloud Run services in `europe-west1`. No paid minimum instances or reserved capacity are used.

## One-time owner-run setup

Choose values locally. Do not save secret values in shell history or in this repository.

```bash
export GCP_PROJECT_ID="replace-me"
export GCP_REGION="europe-west1"
export GCP_WIF_POOL="gitlab"
export GCP_WIF_PROVIDER="gitlab-provider"
export GITLAB_PROJECT_PATH="mayorzeke/life-after-code"
gcloud config set project "$GCP_PROJECT_ID"
gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)'
```

Attaching billing is the hard cost gate. The owner supplies the billing account and runs this only after approval:

```bash
gcloud billing projects link "$GCP_PROJECT_ID" --billing-account="BILLING_ACCOUNT_ID"
```

Create a budget alert in the Cloud Billing console, then enable only the required APIs and create the registry:

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com iamcredentials.googleapis.com sts.googleapis.com
gcloud artifacts repositories create basement --repository-format=docker --location="$GCP_REGION" --description="Basement Autopilot images"
gcloud iam service-accounts create basement-deploy --display-name="Basement GitLab deployer"
gcloud iam service-accounts create basement-runtime --display-name="Basement Cloud Run runtime"
export GCP_PROJECT_NUMBER="$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')"
export GCP_DEPLOY_SA="basement-deploy@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
export CLOUD_RUN_RUNTIME_SA="basement-runtime@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
```

Grant only deployment, registry, service-account use, and secret-read permissions:

```bash
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" --member="serviceAccount:$GCP_DEPLOY_SA" --role=roles/run.admin
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" --member="serviceAccount:$GCP_DEPLOY_SA" --role=roles/run.invoker
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" --member="serviceAccount:$GCP_DEPLOY_SA" --role=roles/artifactregistry.writer
gcloud iam service-accounts add-iam-policy-binding "$CLOUD_RUN_RUNTIME_SA" --member="serviceAccount:$GCP_DEPLOY_SA" --role=roles/iam.serviceAccountUser
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" --member="serviceAccount:$CLOUD_RUN_RUNTIME_SA" --role=roles/secretmanager.secretAccessor
```

Create Workload Identity Federation scoped to this GitLab project:

```bash
gcloud iam workload-identity-pools create "$GCP_WIF_POOL" --location=global --display-name="GitLab CI"
gcloud iam workload-identity-pools providers create-oidc "$GCP_WIF_PROVIDER" \
  --location=global \
  --workload-identity-pool="$GCP_WIF_POOL" \
  --issuer-uri="https://gitlab.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.project_path=assertion.project_path,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.project_path=='$GITLAB_PROJECT_PATH'"
gcloud iam service-accounts add-iam-policy-binding "$GCP_DEPLOY_SA" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${GCP_WIF_POOL}/attribute.project_path/${GITLAB_PROJECT_PATH}"
```

Create the three secret containers, then add values from a protected terminal prompt. Repeat the version command for each provider without echoing the value:

```bash
gcloud secrets create gemini-api-key --replication-policy=automatic
gcloud secrets create deepgram-api-key --replication-policy=automatic
gcloud secrets create groq-api-key --replication-policy=automatic
read -r -s -p "Gemini key: " PROVIDER_SECRET && printf '%s' "$PROVIDER_SECRET" | gcloud secrets versions add gemini-api-key --data-file=- && unset PROVIDER_SECRET
read -r -s -p "Deepgram key: " PROVIDER_SECRET && printf '%s' "$PROVIDER_SECRET" | gcloud secrets versions add deepgram-api-key --data-file=- && unset PROVIDER_SECRET
read -r -s -p "Groq key: " PROVIDER_SECRET && printf '%s' "$PROVIDER_SECRET" | gcloud secrets versions add groq-api-key --data-file=- && unset PROVIDER_SECRET
```

## GitLab CI/CD variables

Add these as project variables. They are identifiers, not provider secrets:

```text
GCP_PROJECT_ID=<project id>
GCP_PROJECT_NUMBER=<project number>
GCP_REGION=europe-west1
GCP_WIF_POOL=gitlab
GCP_WIF_PROVIDER=gitlab-provider
GCP_DEPLOY_SA=basement-deploy@<project id>.iam.gserviceaccount.com
CLOUD_RUN_RUNTIME_SA=basement-runtime@<project id>.iam.gserviceaccount.com
AR_REPO=europe-west1-docker.pkg.dev/<project id>/basement/basement
CLOUD_RUN_SERVICE_STAGING=basement-staging
CLOUD_RUN_SERVICE_PROD=basement
CLOUD_RUN_PUBLIC_ACCESS=0
```

Provider keys stay in Secret Manager and never become GitLab variables. Run `package:artifact-registry`, `deploy:staging`, and `deploy:prod` manually after the setup is complete. Their dependent `smoke:*` jobs run automatically, and staging or production receives traffic only after its smoke check passes. CI exchanges a GitLab OIDC token for short-lived Google credentials and deploys the immutable Artifact Registry digest.

## Hands-off and monitor controls

Keep `AUTOPILOT_MODE=supervised` until a complete supervised run has passed. After billing, WIF, the two Cloud Run services, protected branches/environments, and the deterministic policy have been verified, the owner may set these protected project variables:

```text
AUTOPILOT_MODE=handsoff
GCP_DEPLOY_APPROVED=1
AUTOPILOT_PAUSED=0
```

`GCP_DEPLOY_APPROVED=1` records the separate cost approval; hands-off mode alone cannot make a deployment automatic. Set `AUTOPILOT_PAUSED=1` to stop repair and production deployment. Remove `GCP_DEPLOY_APPROVED` if cloud spending approval is withdrawn.

After a healthy production revision has the `last-good` tag, create an hourly GitLab pipeline schedule on the default branch with cron `17 * * * *` and variable `PIPELINE_KIND=monitor`. Only `monitor:synthetic`, `monitor:rollback`, and `monitor:incident` are eligible in that schedule. The synthetic job makes four small live requests each hour: health, home page, topic generation, and E01 analysis. Every sixth UTC hour it also attempts transcription only when an owner-approved `MONITOR_AUDIO_PATH` exists; otherwise the report says `skipped-no-approved-clip` and makes no audio claim.

For the disclosed rollback drill, create a temporary schedule with both `PIPELINE_KIND=monitor` and `MONITOR_FIRE_DRILL=1`, run it once, inspect all three job artifacts and the incident issue, then delete or deactivate that schedule. The drill performs the real live checks before deliberately failing and is labelled as a fire drill in both the report and issue. Never run it until a verified `last-good` revision exists.

An hourly schedule creates 24 GitLab pipelines and about 48 Gemini text requests per day, plus four transcription requests per day only if the approved clip is configured. It also consumes GitLab CI minutes and small Cloud Run request/compute usage. Exact cost depends on the owner's GitLab and Google plans and current provider pricing; a zero bill is not guaranteed. Creating the schedule and enabling `GCP_DEPLOY_APPROVED` therefore remain owner actions after the cost gate.

## Public access gate

The deployment script uses `--no-allow-unauthenticated` unless `CLOUD_RUN_PUBLIC_ACCESS=1`. Do not change that variable or add an `allUsers` invoker binding until the owner explicitly approves making the service public. Private smoke checks use an identity token.

## Configuration files

`service-staging.yaml` and `service-prod.yaml` document the desired scale, runtime identity, secrets, and resource limits. Their project ID and image digest placeholders are intentional. The CI deployment script supplies the real immutable digest and equivalent settings; do not apply the templates without replacing every placeholder.
