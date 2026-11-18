from app.domain.importers.base import AssignmentDraft


class MoodleApiSource:
    """Future adapter for Moodle Web Services (not in v1).

    To plug it in: the student creates a token in Moodle (Preferences → Security keys, service
    "Moodle mobile web service"), then call `core_calendar_get_action_events_by_timesort` (or
    `mod_assign_get_assignments`) on `https://<moodle>/webservice/rest/server.php?wstoken=…&moodlewsrestformat=json`
    and map each event to AssignmentDraft(title=name, deadline=timesort, course=course.shortname,
    external_uid=f"moodle-{id}"). The import service upserts drafts the same way as for .ics.
    """

    def __init__(self, base_url: str, token: str) -> None:
        self.base_url = base_url
        self.token = token

    def parse(self, data: bytes) -> list[AssignmentDraft]:
        raise NotImplementedError("Moodle API sync is planned after v1; import the .ics export instead")
