from pathlib import Path

from app.adapters import JsonRuleRepository
from app.services import RuleEngine


DEFAULT_RULES_PATH = Path(__file__).parents[1] / "app" / "rules" / "default_rules.json"


def create_default_rule_engine() -> RuleEngine:
    return RuleEngine(JsonRuleRepository(DEFAULT_RULES_PATH))
