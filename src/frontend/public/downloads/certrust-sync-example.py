#!/usr/bin/env python3
"""
Certrust sync example for a student records system.

Reads a CSV export with one row per student who has earned a credential,
issues the credentials through a Certrust issuance job, waits for the job
to finish, and writes the outcome for every student to a results CSV so
the certificate links can be loaded back into your own system.

It is safe to run again with the same file: students who already hold the
credential are skipped, and a repeated request returns the first answer.

Needs Python 3.8+ and nothing else. Guide:
https://certrust.app/integrations/student-records

Usage:
  export CERTRUST_API_KEY=crt_...
  python3 certrust-sync-example.py --achievement 12 --input graduates.csv --output results.csv

Input CSV columns (header row required):
  name, email           required
  student_id            optional; never sent to Certrust, only copied to the results
  expiry_date           optional, YYYY-MM-DD
  <attribute key>       optional; one column per custom attribute your
                        organization has set up in Certrust, named by its key

Only the name, email, expiry date and those custom attributes are sent to
Certrust. Every other column in the file stays on your machine.
"""
import argparse
import csv
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = os.environ.get("CERTRUST_API_URL", "https://api.certrust.app").rstrip("/")
SITE = os.environ.get("CERTRUST_SITE_URL", "https://certrust.app").rstrip("/")
MAX_PER_JOB = 2000


def call(method, path, key, body=None, idempotency_key=None):
    """One API request. Waits and retries when the API says to (409, 429) or is briefly unavailable."""
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"Authorization": f"Bearer {key}", "Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    for attempt in range(8):
        request = urllib.request.Request(API + path, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            text = error.read().decode("utf-8", "replace")
            if error.code in (409, 429) or error.code >= 500:
                wait = int(error.headers.get("Retry-After") or 0) or min(60, 2 ** attempt)
                time.sleep(wait)
                continue
            try:
                message = json.loads(text)["error"]["message"]
            except Exception:
                message = text[:200]
            raise SystemExit(f"Certrust refused the request ({error.code}): {message}")
        except urllib.error.URLError:
            time.sleep(min(60, 2 ** attempt))
    raise SystemExit("Certrust could not be reached. Nothing was lost: run the same command again.")


def read_students(path):
    with open(path, newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        columns = [c.strip().lower() for c in (reader.fieldnames or [])]
        if "name" not in columns or "email" not in columns:
            raise SystemExit('The input file needs "name" and "email" columns in its first row.')
        students = []
        for row in reader:
            row = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items()}
            if row.get("email"):
                students.append(row)
        return students


def to_recipient(student, attribute_keys):
    recipient = {"name": student["name"], "email": student["email"]}
    if student.get("expiry_date"):
        recipient["expirationDate"] = student["expiry_date"]
    custom = {k: student[k] for k in attribute_keys if student.get(k)}
    if custom:
        recipient["customFields"] = custom
    return recipient


def run_job(key, achievement_id, students, attribute_keys):
    body = {"data": {
        "achievementId": achievement_id,
        "skipExisting": True,
        "recipients": [to_recipient(s, attribute_keys) for s in students],
    }}
    # The same students for the same achievement always produce the same key,
    # so a run that is repeated by mistake cannot start a second job.
    digest = hashlib.sha256(json.dumps(body, sort_keys=True).encode("utf-8")).hexdigest()
    job = call("POST", "/api/issuance-jobs", key, body, idempotency_key=f"sync-{digest}")["data"]
    while job["status"] in ("queued", "running"):
        print(f'  {job["processed"]}/{job["total"]} processed', flush=True)
        time.sleep(5)
        job = call("GET", f'/api/issuance-jobs/{job["documentId"]}', key)["data"]
    if job["status"] != "completed":
        raise SystemExit(f'The job ended as "{job["status"]}": {job.get("error") or "no further detail"}')
    return call("GET", f'/api/issuance-jobs/{job["documentId"]}', key)["data"]["results"]


def main():
    parser = argparse.ArgumentParser(description="Issue Certrust credentials from a CSV export.")
    parser.add_argument("--achievement", type=int, required=True, help="numeric id of the achievement to issue")
    parser.add_argument("--input", required=True, help="CSV export from your student records system")
    parser.add_argument("--output", required=True, help="where to write the results CSV")
    args = parser.parse_args()

    key = os.environ.get("CERTRUST_API_KEY")
    if not key:
        raise SystemExit("Set the CERTRUST_API_KEY environment variable to your API key.")

    me = call("GET", "/api/api-keys/me", key)["data"]
    if "issue" not in me["scopes"]:
        raise SystemExit("This API key does not have the Issue permission.")
    # Only columns that are custom attributes in Certrust are ever sent.
    attribute_keys = []
    if "read" in me["scopes"]:
        attribute_keys = [a["key"] for a in call("GET", "/api/custom-attributes", key)["data"]]
    students = read_students(args.input)
    print(f'{me["organization"]["name"]}: {len(students)} students to process')

    counts = {"issued": 0, "already_issued": 0, "failed": 0}
    with open(args.output, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["student_id", "name", "email", "outcome", "credential_id", "certificate_url", "error"])
        for start in range(0, len(students), MAX_PER_JOB):
            chunk = students[start:start + MAX_PER_JOB]
            results = run_job(key, args.achievement, chunk, attribute_keys)
            for student, result in zip(chunk, results):
                if not result["success"]:
                    outcome = "failed"
                elif result.get("skipped"):
                    outcome = "already_issued"
                else:
                    outcome = "issued"
                counts[outcome] += 1
                credential_id = result.get("credentialId") or ""
                url = f"{SITE}/credentials/{urllib.parse.quote(credential_id, safe='')}" if credential_id else ""
                writer.writerow([student.get("student_id", ""), student["name"], student["email"], outcome, credential_id, url, result.get("error", "")])

    print(f'Done: {counts["issued"]} issued, {counts["already_issued"]} already issued, {counts["failed"]} failed. Results in {args.output}')
    return 1 if counts["failed"] else 0


if __name__ == "__main__":
    sys.exit(main())
