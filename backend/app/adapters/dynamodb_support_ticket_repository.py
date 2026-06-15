from typing import Any
from uuid import UUID

from app.adapters.dynamodb_mapper import (
    TICKET_SK_PREFIX,
    deserialize_item,
    order_pk,
    ticket_item_to_support_ticket,
)
from app.domain import SupportTicket
from app.ports import SupportTicketRepository


class DynamoDBSupportTicketRepository(SupportTicketRepository):
    def __init__(self, client: Any, table_name: str) -> None:
        self._client = client
        self._table_name = table_name

    def list_by_order_id(self, order_id: UUID) -> list[SupportTicket]:
        items: list[dict[str, Any]] = []
        request: dict[str, Any] = {
            "TableName": self._table_name,
            "KeyConditionExpression": "PK = :pk AND begins_with(SK, :sk_prefix)",
            "ExpressionAttributeValues": {
                ":pk": {"S": order_pk(order_id)},
                ":sk_prefix": {"S": TICKET_SK_PREFIX},
            },
            "ConsistentRead": True,
        }

        while True:
            response = self._client.query(**request)
            items.extend(response.get("Items", []))
            last_evaluated_key = response.get("LastEvaluatedKey")
            if last_evaluated_key is None:
                return [
                    ticket_item_to_support_ticket(deserialize_item(item))
                    for item in items
                ]
            request["ExclusiveStartKey"] = last_evaluated_key
