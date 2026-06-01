from datetime import date, timedelta

import pytest

from tests.conftest import auth_header, login


async def _new_task(client, token, assignee_id, **over):
    body = {
        "title": over.get("title", "Test task"),
        "description": "desc",
        "priority": "High",
        "assignee_id": str(assignee_id),
        "due_date": (date.today() + timedelta(days=5)).isoformat(),
        "estimated_effort": 4,
        "effort_unit": "hours",
        "tags": ["backend"],
        "depends_on_task_ids": over.get("depends_on_task_ids", []),
    }
    return await client.post("/api/v1/tasks", json=body, headers=auth_header(token))


async def test_assignee_can_self_assign(client, users):
    # Assignees may create a task assigned to themselves (chat self-assign flow).
    token = await login(client, "jordan@test.dev")
    resp = await _new_task(client, token, users["assignee"].id)
    assert resp.status_code == 201
    assert resp.json()["assignee"]["id"] == str(users["assignee"].id)


async def test_assignee_cannot_assign_others(client, users):
    # Assignees may NOT assign tasks to other people.
    token = await login(client, "jordan@test.dev")
    resp = await _new_task(client, token, users["assigner"].id)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_full_lifecycle(client, users):
    assigner = await login(client, "alex@test.dev")
    assignee = await login(client, "jordan@test.dev")

    created = await _new_task(client, assigner, users["assignee"].id)
    assert created.status_code == 201
    task_id = created.json()["id"]
    assert created.json()["status"] == "Queued"

    # assignee starts it
    start = await client.post(
        f"/api/v1/tasks/{task_id}/status",
        json={"status": "In Progress"},
        headers=auth_header(assignee),
    )
    assert start.status_code == 200
    assert start.json()["status"] == "In Progress"

    # assigner cannot start (role guard)
    bad = await client.post(
        f"/api/v1/tasks/{task_id}/status",
        json={"status": "Pending Review"},
        headers=auth_header(assigner),
    )
    assert bad.status_code == 403

    # post a progress update
    upd = await client.post(
        f"/api/v1/tasks/{task_id}/updates",
        json={"current_work": "did stuff", "next_steps": "more stuff"},
        headers=auth_header(assignee),
    )
    assert upd.status_code == 201

    # submit for review
    submit = await client.post(
        f"/api/v1/tasks/{task_id}/status",
        json={"status": "Pending Review"},
        headers=auth_header(assignee),
    )
    assert submit.status_code == 200

    # approve
    approve = await client.post(
        f"/api/v1/tasks/{task_id}/approve",
        json={"comment": "great"},
        headers=auth_header(assigner),
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == "Approved"
    assert approve.json()["approved_at"] is not None
    assert len(approve.json()["approval_events"]) == 1


async def test_blocked_task_cannot_start(client, users):
    assigner = await login(client, "alex@test.dev")
    assignee = await login(client, "jordan@test.dev")

    dep = await _new_task(client, assigner, users["assignee"].id, title="Dependency")
    dep_id = dep.json()["id"]
    blocked = await _new_task(
        client, assigner, users["assignee"].id, title="Blocked", depends_on_task_ids=[dep_id]
    )
    blocked_id = blocked.json()["id"]
    assert blocked.json()["is_blocked"] is True

    resp = await client.post(
        f"/api/v1/tasks/{blocked_id}/status",
        json={"status": "In Progress"},
        headers=auth_header(assignee),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "TASK_BLOCKED"


async def test_dependency_auto_unblock(client, users):
    assigner = await login(client, "alex@test.dev")
    assignee = await login(client, "jordan@test.dev")

    dep = await _new_task(client, assigner, users["assignee"].id, title="Dependency")
    dep_id = dep.json()["id"]
    blocked = await _new_task(
        client, assigner, users["assignee"].id, title="Blocked", depends_on_task_ids=[dep_id]
    )
    blocked_id = blocked.json()["id"]

    # drive dependency to Approved
    await client.post(f"/api/v1/tasks/{dep_id}/status", json={"status": "In Progress"}, headers=auth_header(assignee))
    await client.post(f"/api/v1/tasks/{dep_id}/status", json={"status": "Pending Review"}, headers=auth_header(assignee))
    await client.post(f"/api/v1/tasks/{dep_id}/approve", json={}, headers=auth_header(assigner))

    detail = await client.get(f"/api/v1/tasks/{blocked_id}", headers=auth_header(assigner))
    assert detail.json()["is_blocked"] is False


async def test_circular_dependency_rejected(client, users):
    assigner = await login(client, "alex@test.dev")
    a = await _new_task(client, assigner, users["assignee"].id, title="A")
    b = await _new_task(client, assigner, users["assignee"].id, title="B")
    a_id, b_id = a.json()["id"], b.json()["id"]

    # B depends on A
    r1 = await client.post(
        f"/api/v1/tasks/{b_id}/dependencies",
        json={"depends_on_task_id": a_id},
        headers=auth_header(assigner),
    )
    assert r1.status_code == 201
    # A depends on B -> cycle
    r2 = await client.post(
        f"/api/v1/tasks/{a_id}/dependencies",
        json={"depends_on_task_id": b_id},
        headers=auth_header(assigner),
    )
    assert r2.status_code == 422
    assert r2.json()["error"]["code"] == "CIRCULAR_DEPENDENCY"
