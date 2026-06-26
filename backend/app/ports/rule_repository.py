from typing import Protocol

from app.domain import OrderRule


class RuleRepository(Protocol):
    """Source of enabled business rules.

    The port is intentionally read-only for the MVP so a future persistent
    adapter can replace local JSON without changing rule evaluation.
    """

    def list_enabled(self) -> list[OrderRule]:
        ...
