"""iCalendar (.ics) adapter tuned for Moodle calendar exports."""

import hashlib
import re
from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from icalendar import Calendar

from app.domain.importers.base import AssignmentDraft, InvalidSourceError

MAX_EVENTS = 500
MAX_TITLE = 200
MAX_DESCRIPTION = 10_000

# Moodle appends the event kind to the activity name ("Lab 3 is due"). Deadline-like kinds are stripped;
# "opens" events mark the start of an activity, not a deadline, so they are skipped.
_DEADLINE_SUFFIXES = re.compile(
    r"\s+(is due|closes|should be completed|due|має бути виконано|закривається|термін здачі)\s*$", re.I
)
_OPENING_SUFFIX = re.compile(r"\s+(opens|відкривається)\s*$", re.I)
_TAGS = re.compile(r"<[^>]+>")


def clean_title(summary: str) -> str:
    title = _DEADLINE_SUFFIXES.sub("", summary.strip())
    return title.strip(" «»\"'") or summary.strip()


def is_opening_event(summary: str) -> bool:
    return bool(_OPENING_SUFFIX.search(summary.strip()))


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
            if not summary or when is None or is_opening_event(summary):
                continue
            deadline = self._to_utc(when.dt)
            description = _TAGS.sub("", str(event.get("DESCRIPTION", ""))).strip()[:MAX_DESCRIPTION]
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
        names = [str(c).strip() for item in items for c in getattr(item, "cats", [item])]
        names = [n for n in names if n]
        return names[0][:100] if names else None

    @staticmethod
    def _fallback_uid(summary: str, deadline: datetime) -> str:
        return "ics-" + hashlib.sha1(f"{summary}|{deadline.isoformat()}".encode()).hexdigest()
