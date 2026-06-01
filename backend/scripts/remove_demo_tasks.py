"""Soft-delete the 8 original demo/seed tasks, leaving the imported real tasks.

Each task can only be deleted by its creating Assigner, so we log in as both
seed assigners and delete by matching the task's assigner email.
"""
import os

import httpx

API_BASE = os.environ.get("API_BASE", "http://127.0.0.1:8000/api/v1")
PASSWORD = os.environ.get("SEED_PASSWORD", "password123")

DEMO_TITLES = {
    "Design new onboarding flow",
    "API integration for payments",
    "Write unit tests for auth module",
    "Update privacy policy page",
    "Set up CI/CD pipeline",
    "Conduct user interviews",
    "Fix checkout bug on mobile",
    "Q3 performance review docs",
}

ASSIGNER_EMAILS = ["alex@taskflow.dev", "casey@taskflow.dev"]


def main() -> None:
    with httpx.Client(base_url=API_BASE, timeout=30) as c:
        tokens: dict[str, str] = {}
        for email in ASSIGNER_EMAILS:
            r = c.post("/auth/login", json={"email": email, "password": PASSWORD})
            tokens[email] = r.json()["access_token"]
        admin = {"Authorization": f"Bearer {tokens[ASSIGNER_EMAILS[0]]}"}

        # gather all tasks (paginate)
        demo = []
        page = 1
        while True:
            resp = c.get("/tasks", headers=admin, params={"page": page, "per_page": 100}).json()
            for t in resp["data"]:
                if t["title"] in DEMO_TITLES:
                    demo.append(t)
            if page * 100 >= resp["meta"]["total"]:
                break
            page += 1

        deleted, failed = 0, 0
        for t in demo:
            email = t["assigner"]["email"]
            tok = tokens.get(email)
            if not tok:
                print(f"  no token for assigner {email}; skipping '{t['title']}'")
                failed += 1
                continue
            r = c.delete(f"/tasks/{t['id']}", headers={"Authorization": f"Bearer {tok}"})
            if r.status_code == 204:
                deleted += 1
                print(f"  deleted: {t['title']} (by {t['assigner']['name']})")
            else:
                failed += 1
                print(f"  FAILED [{r.status_code}] {t['title']}: {r.text[:120]}")

        print(f"\nDeleted {deleted} demo task(s); failed {failed}.")
        remaining = c.get("/tasks", headers=admin, params={"per_page": 1}).json()["meta"]["total"]
        print(f"Tasks remaining: {remaining}")


if __name__ == "__main__":
    main()
