from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from app.domain.importers import IcsSource, InvalidSourceError, MoodleApiSource, clean_title

KYIV = ZoneInfo("Europe/Kyiv")
NOW = datetime.now(timezone.utc)


def stamp(days: int) -> str:
    return (NOW + timedelta(days=days)).strftime("%Y%m%dT%H%M%SZ")


def day(days: int) -> str:
    return (NOW + timedelta(days=days)).astimezone(KYIV).strftime("%Y%m%d")


def event(uid: str, summary: str, when: str, extra: str = "") -> str:
    return f"BEGIN:VEVENT\r\nUID:{uid}\r\nSUMMARY:{summary}\r\n{when}\r\n{extra}END:VEVENT\r\n"


def calendar(*events: str) -> bytes:
    body = "".join(events)
    return (
        "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Moodle Pty Ltd//NONSGML Moodle Version 2024//EN\r\n"
        f"{body}END:VCALENDAR\r\n"
    ).encode()


def moodle_export(lab_days: int = 7, lab_desc: str = "Implement the REST API and write tests") -> bytes:
    return calendar(
        event("1@moodle.ucu.edu.ua", "Lab 3 is due", f"DTSTART:{stamp(lab_days)}\r\nDTEND:{stamp(lab_days)}",
              f"DESCRIPTION:<p>{lab_desc}</p>\r\nCATEGORIES:OOAD\r\n"),
        event("2@moodle.ucu.edu.ua", "Есе з філософії має бути виконано", f"DTSTART;VALUE=DATE:{day(10)}",
              "CATEGORIES:Philosophy\r\n"),
        event("3@moodle.ucu.edu.ua", "Quiz 2 opens", f"DTSTART:{stamp(2)}"),
        event("4@moodle.ucu.edu.ua", "Old homework is due", f"DTSTART:{stamp(-60)}"),
    )


def upload(client, data: bytes, name: str = "icalexport.ics"):
    return client.post("/api/import/ics", files={"file": (name, data, "text/calendar")})


# ---------- domain: parsing ----------

def test_clean_title():
    assert clean_title("Lab 3 is due") == "Lab 3"
    assert clean_title("Final quiz closes") == "Final quiz"
    assert clean_title("«Звіт» має бути виконано") == "Звіт"
    assert clean_title("Project") == "Project"


def test_parse_moodle_export():
    drafts = IcsSource(KYIV).parse(moodle_export())
    by_uid = {d.external_uid: d for d in drafts}
    assert set(by_uid) == {"1@moodle.ucu.edu.ua", "2@moodle.ucu.edu.ua", "4@moodle.ucu.edu.ua"}  # "opens" skipped
    lab = by_uid["1@moodle.ucu.edu.ua"]
    assert (lab.title, lab.course, lab.description) == ("Lab 3", "OOAD", "Implement the REST API and write tests")
    assert lab.deadline.tzinfo is not None
    essay = by_uid["2@moodle.ucu.edu.ua"]
    local = essay.deadline.astimezone(KYIV)
    assert essay.title == "Есе з філософії" and (local.hour, local.minute) == (23, 59)


def test_floating_time_is_read_in_local_zone_and_missing_uid_gets_stable_hash():
    data = calendar("BEGIN:VEVENT\r\nSUMMARY:Report\r\nDTSTART:20301010T120000\r\nEND:VEVENT\r\n")
    a, b = IcsSource(KYIV).parse(data), IcsSource(KYIV).parse(data)
    assert a[0].deadline.astimezone(KYIV).hour == 12
    assert a[0].external_uid == b[0].external_uid and a[0].external_uid.startswith("ics-")


@pytest.mark.parametrize("data", [b"hello", b"BEGIN:VEVENT\r\nEND:VEVENT\r\n"])
def test_invalid_calendar(data):
    with pytest.raises(InvalidSourceError):
        IcsSource(KYIV).parse(data)


def test_moodle_api_is_a_stub():
    with pytest.raises(NotImplementedError):
        MoodleApiSource("https://moodle.ucu.edu.ua", "token").parse(b"")


# ---------- API: upsert ----------

def test_import_creates_skips_and_estimates(signed_in):
    r = upload(signed_in, moodle_export())
    assert r.status_code == 200, r.text
    body = r.json()
    assert (body["created"], body["updated"], body["skipped"]) == (2, 0, 1)
    assert len(body["created_ids"]) == 2

    plan = signed_in.get("/api/plan").json()
    lab = next(a for a in plan["assignments"] if a["title"] == "Lab 3")
    assert lab["source"] == "ics" and lab["course_name"] == "OOAD"
    assert lab["estimate_source"] == "heuristic" and lab["ai_hours"] == 4.0
    assert lab["window"]["status"] in {"can_wait", "time_to_start"}


def test_reimport_updates_deadline_and_keeps_student_fields(signed_in):
    first = upload(signed_in, moodle_export(lab_days=7)).json()
    lab_id = first["created_ids"][0]
    signed_in.patch(f"/api/assignments/{lab_id}", json={"user_hours": 9, "done": True})

    again = upload(signed_in, moodle_export(lab_days=9, lab_desc="Updated brief")).json()
    assert (again["created"], again["updated"], again["skipped"]) == (0, 2, 1)

    lab = next(a for a in signed_in.get("/api/plan").json()["assignments"] if a["id"] == lab_id)
    assert lab["user_hours"] == 9 and lab["done"] is True and lab["description"] == "Updated brief"
    expected = (NOW + timedelta(days=9)).date()
    assert abs((datetime.fromisoformat(lab["deadline"].replace("Z", "+00:00")).date() - expected).days) <= 1


def test_duplicate_uid_in_one_file_counts_once(signed_in):
    e = event("dup@x", "Lab is due", f"DTSTART:{stamp(5)}", "CATEGORIES:OOAD\r\n")
    body = upload(signed_in, calendar(e, e)).json()
    assert (body["created"], body["skipped"]) == (1, 1)


def test_import_is_per_user(client, signed_in):
    upload(signed_in, moodle_export())
    client.post("/api/auth/signout")
    client.post("/api/auth/signup", json={"email": "bob@ucu.edu.ua", "password": "secret123", "name": "Bob"})
    body = upload(client, moodle_export()).json()
    assert body["created"] == 2 and body["updated"] == 0


def test_import_errors(client, signed_in):
    assert upload(signed_in, b"not a calendar").status_code == 422
    assert upload(signed_in, b"   ").status_code == 422
    assert upload(signed_in, b"x" * 1_000_001).status_code == 413
    client.post("/api/auth/signout")
    assert upload(client, moodle_export()).status_code == 401
