from __future__ import annotations

import time

import boto3
from botocore.exceptions import ClientError, EndpointConnectionError

from app.config import (
    get_aws_region,
    get_dynamodb_endpoint_url,
    get_dynamodb_table_name,
)


def create_client():
    return boto3.client(
        "dynamodb",
        region_name=get_aws_region(),
        endpoint_url=get_dynamodb_endpoint_url(),
    )


def wait_for_endpoint(client, attempts: int = 30, delay_seconds: float = 1.0) -> None:
    for attempt in range(1, attempts + 1):
        try:
            client.list_tables(Limit=1)
            return
        except EndpointConnectionError:
            if attempt == attempts:
                raise
            time.sleep(delay_seconds)


def create_table_if_needed(client, table_name: str) -> None:
    try:
        client.create_table(
            TableName=table_name,
            KeySchema=[
                {"AttributeName": "PK", "KeyType": "HASH"},
                {"AttributeName": "SK", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "PK", "AttributeType": "S"},
                {"AttributeName": "SK", "AttributeType": "S"},
                {"AttributeName": "GSI1PK", "AttributeType": "S"},
                {"AttributeName": "GSI1SK", "AttributeType": "S"},
            ],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "GSI1",
                    "KeySchema": [
                        {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                        {"AttributeName": "GSI1SK", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                }
            ],
            BillingMode="PAY_PER_REQUEST",
        )
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") != "ResourceInUseException":
            raise

    client.get_waiter("table_exists").wait(TableName=table_name)


def main() -> None:
    client = create_client()
    wait_for_endpoint(client)
    create_table_if_needed(client, get_dynamodb_table_name())


if __name__ == "__main__":
    main()
