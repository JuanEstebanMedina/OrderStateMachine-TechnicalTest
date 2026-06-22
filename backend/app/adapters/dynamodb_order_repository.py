from typing import Any
from uuid import UUID

from botocore.exceptions import ClientError

from app.adapters.dynamodb_mapper import (
    EVENT_SK_PREFIX,
    GSI1_NAME,
    GSI1_ORDERS_PK,
    ORDER_SK,
    deserialize_item,
    event_log_to_item,
    format_utc_timestamp,
    order_item_and_event_items_to_order,
    order_item_to_order_summary,
    order_pk,
    order_to_item,
    serialize_item,
    serialize_key,
    support_ticket_to_item,
)
from app.domain import (
    Order,
    OrderEventLog,
    OrderSummary,
    OrderVersionConflictError,
    SupportTicket,
)
from app.ports import OrderRepository


ITEM_KEY_NOT_EXISTS_CONDITION = "attribute_not_exists(PK) AND attribute_not_exists(SK)"


class DynamoDBOrderRepository(OrderRepository):
    def __init__(
        self,
        client: Any,
        table_name: str,
    ) -> None:
        self._client = client
        self._table_name = table_name

    def create(self, order: Order) -> Order:
        try:
            self._client.put_item(
                TableName=self._table_name,
                Item=serialize_item(order_to_item(order)),
                ConditionExpression=ITEM_KEY_NOT_EXISTS_CONDITION,
            )
        except self._client.exceptions.ConditionalCheckFailedException as error:
            raise ValueError(f"Order {order.id} already exists") from error

        return order

    def get_by_id(self, order_id: UUID) -> Order | None:
        response = self._client.get_item(
            TableName=self._table_name,
            Key=serialize_key(order_pk(order_id), ORDER_SK),
            ConsistentRead=True,
        )
        raw_order_item = response.get("Item")
        if raw_order_item is None:
            return None

        order_item = deserialize_item(raw_order_item)
        event_items = [
            deserialize_item(item)
            for item in self._query_all(
                KeyConditionExpression="PK = :pk AND begins_with(SK, :sk_prefix)",
                ExpressionAttributeValues={
                    ":pk": {"S": order_pk(order_id)},
                    ":sk_prefix": {"S": EVENT_SK_PREFIX},
                },
                ConsistentRead=True,
            )
        ]
        return order_item_and_event_items_to_order(order_item, event_items)

    def list_summaries(self) -> list[OrderSummary]:
        items = self._query_all(
            IndexName=GSI1_NAME,
            KeyConditionExpression="GSI1PK = :gsi_pk",
            ExpressionAttributeValues={":gsi_pk": {"S": GSI1_ORDERS_PK}},
        )
        return [order_item_to_order_summary(deserialize_item(item)) for item in items]

    def commit_transition(
        self,
        order: Order,
        event_log: OrderEventLog,
        support_ticket: SupportTicket | None,
        expected_version: int,
    ) -> Order:
        # Keep the order update first so cancellation reason index 0 identifies
        # the optimistic-lock check we intentionally translate to a domain
        # conflict.
        transact_items: list[dict[str, Any]] = [
            {
                "Update": {
                    "TableName": self._table_name,
                    "Key": serialize_key(order_pk(order.id), ORDER_SK),
                    "UpdateExpression": (
                        "SET currentState = :to_state, "
                        "#version = :new_version, "
                        "updatedAt = :updated_at"
                    ),
                    "ConditionExpression": (
                        "#version = :expected_version AND currentState = :from_state"
                    ),
                    # Version detects stale writers; source state detects races
                    # where the version is current but the intended transition
                    # no longer starts from the loaded state.
                    "ExpressionAttributeNames": {"#version": "version"},
                    "ExpressionAttributeValues": serialize_item(
                        {
                            ":to_state": order.current_state.value,
                            ":new_version": order.version,
                            ":updated_at": format_utc_timestamp(order.updated_at),
                            ":expected_version": expected_version,
                            ":from_state": event_log.from_state.value,
                        }
                    ),
                }
            },
            {
                "Put": {
                    "TableName": self._table_name,
                    "Item": serialize_item(event_log_to_item(order.id, event_log)),
                    "ConditionExpression": ITEM_KEY_NOT_EXISTS_CONDITION,
                }
            },
        ]

        if support_ticket is not None:
            transact_items.append(
                {
                    "Put": {
                        "TableName": self._table_name,
                        "Item": serialize_item(support_ticket_to_item(support_ticket)),
                        "ConditionExpression": ITEM_KEY_NOT_EXISTS_CONDITION,
                    }
                }
            )

        try:
            # The token protects retries of this already-built DynamoDB
            # transaction. Separate HTTP requests create new event IDs, so this
            # is not client-level idempotency.
            self._client.transact_write_items(
                TransactItems=transact_items,
                ClientRequestToken=str(event_log.id),
            )
        except self._client.exceptions.TransactionCanceledException as error:
            self._raise_conflict_for_order_condition(error, order.id, expected_version)
            raise

        return order

    def _query_all(self, **kwargs: Any) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        request = {"TableName": self._table_name, **kwargs}

        while True:
            response = self._client.query(**request)
            items.extend(response.get("Items", []))
            last_evaluated_key = response.get("LastEvaluatedKey")
            if last_evaluated_key is None:
                return items
            request["ExclusiveStartKey"] = last_evaluated_key

    def _raise_conflict_for_order_condition(
        self,
        error: ClientError,
        order_id: UUID,
        expected_version: int,
    ) -> None:
        reasons = error.response.get("CancellationReasons", [])
        # Only the order update's conditional failure is a business conflict;
        # later item failures or AWS transaction conflicts remain infrastructure
        # errors for the caller to handle.
        if reasons and reasons[0].get("Code") == "ConditionalCheckFailed":
            raise OrderVersionConflictError(order_id, expected_version) from error
