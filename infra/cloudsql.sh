#!/usr/bin/env bash
# Stop/start the Cloud SQL instance to save credit when idle. Stopping pauses the
# compute charge (~$10/mo); the 10GB storage (~$2/mo) keeps billing until the
# instance is deleted. Cloud Run scales to zero and Firebase Hosting is free, so
# this is the only meaningful idle cost.
#
#   infra/cloudsql.sh stop     # pause when not demoing
#   infra/cloudsql.sh start    # resume
#   infra/cloudsql.sh status
set -euo pipefail
INSTANCE=pbuddy-db
case "${1:-status}" in
  stop)   gcloud sql instances patch "$INSTANCE" --activation-policy=NEVER  --quiet ;;
  start)  gcloud sql instances patch "$INSTANCE" --activation-policy=ALWAYS --quiet ;;
  status) gcloud sql instances describe "$INSTANCE" \
            --format="value(state,settings.activationPolicy)" ;;
  *) echo "usage: $0 stop|start|status" >&2; exit 1 ;;
esac
