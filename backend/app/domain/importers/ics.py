"""iCalendar (.ics) adapter tuned for Moodle calendar exports."""

import hashlib
import html
import re
from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from icalendar import Calendar

from app.domain.importers.base import AssignmentDraft, InvalidSourceError

MAX_EVENTS = 500
MAX_TITLE = 200
MAX_DESCRIPTION = 10_000

# Moodle wraps the activity name with the event kind, in the user's language
# (seen in UCU exports: "Lab 3 is due", "Строк Lab 3 спливає", "Quiz 11 закрито", "X слід заповнити").
# Deadline-like kinds are stripped. "opens" events mark the start of an activity and attendance marks
# are not work, so both are skipped.
_DEADLINE_PREFIX = re.compile(r"^(строк|термін)\s+", re.I)
_DEADLINE_SUFFIXES = re.compile(
    r"\s+(submission is due|is due|closes|should be completed|due|спливає|слід заповнити|закрито|"
    r"має бути виконано|закривається|термін здачі)\s*$",
    re.I,
)
_SKIP = [re.compile(r"\s+(opens|відкривається|відкрито|доступно)\s*$", re.I), re.compile(r"^(відвідування|attendance)\b", re.I)]
_TERM_CODE = re.compile(r"\s*\([\d.\-\s]+\)\s*$")  # "(1.26-27.)" after course names
_TAGS = re.compile(r"<[^>]+>")


def clean_title(summary: str) -> str:
    raw = html.unescape(summary).strip()
    title = _DEADLINE_SUFFIXES.sub("", _DEADLINE_PREFIX.sub("", raw)).strip()
    if len(title) > 1 and (title[0], title[-1]) in {("«", "»"), ('"', '"'), ("'", "'")}:
        title = title[1:-1].strip()
    return title or raw


def is_skipped_event(summary: str) -> bool:
    raw = html.unescape(summary).strip()
    return any(p.search(raw) for p in _SKIP)


def clean_course(name: str) -> str:
    return _TERM_CODE.sub("", html.unescape(name)).strip()


class IcsSource:
    """Parses VEVENTs into drafts. Date-only events are due at 23:59 local time;
    floating (zone-less) times are read in `tz`."""

    def __init__(self, tz: ZoneInfo) -> None:
        self.tz = tz

    def parse(self, data: bytes) -> list[AssignmentDraft]:
        try:
            cal = Calendar.from_ical(data)
        except Exception as exc:
            raise InvalidSourceError("Not a valid .ics calendar") from exc
        if getattr(cal, "name", "") != "VCALENDAR":
            raise InvalidSourceError("Not a valid .ics calendar")

        drafts: list[AssignmentDraft] = []
        for event in cal.walk("VEVENT")[:MAX_EVENTS]:
            summary = str(event.get("SUMMARY", "")).strip()
            when = event.get("DTEND") or event.get("DTSTART")
            if not summary or when is None or is_skipped_event(summary):
                continue
            deadline = self._to_utc(when.dt)
            description = html.unescape(_TAGS.sub("", str(event.get("DESCRIPTION", "")))).strip()[:MAX_DESCRIPTION]
            uid = str(event.get("UID", "")).strip() or self._fallback_uid(summary, deadline)
            drafts.append(
                AssignmentDraft(
                    title=clean_title(summary)[:MAX_TITLE],
                    deadline=deadline,
                    description=description,
                    course=self._course(event),
                    external_uid=uid[:255],
                )
            )
        return drafts

    def _to_utc(self, value: date | datetime) -> datetime:
        if not isinstance(value, datetime):  # all-day event
            value = datetime.combine(value, time(23, 59), self.tz)
        elif value.tzinfo is None:
            value = value.replace(tzinfo=self.tz)
        return value.astimezone(timezone.utc)

    @staticmethod
    def _course(event) -> str | None:
        raw = event.get("CATEGORIES")
        if raw is None:
            return None
        items = raw if isinstance(raw, list) else [raw]
        names = [clean_course(str(c)) for item in items for c in getattr(item, "cats", [item])]
        names = [n for n in names if n]
        return names[0][:100] if names else None

    @staticmethod
    def _fallback_uid(summary: str, deadline: datetime) -> str:
        return "ics-" + hashlib.sha1(f"{summary}|{deadline.isoformat()}".encode()).hexdigest()
