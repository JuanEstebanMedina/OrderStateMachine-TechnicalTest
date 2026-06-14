from enum import Enum


class OrderEventType(str, Enum):
    INIT = "init"
    PENDING_BIOMETRICAL_VERIFICATION = "pendingBiometricalVerification"
    NO_VERIFICATION_NEEDED = "noVerificationNeeded"
    PAYMENT_FAILED = "paymentFailed"
    ORDER_CANCELLED = "orderCancelled"
    BIOMETRICAL_VERIFICATION_SUCCESSFUL = "biometricalVerificationSuccessful"
    VERIFICATION_FAILED = "verificationFailed"
    ORDER_CANCELLED_BY_USER = "orderCancelledByUser"
    PAYMENT_SUCCESSFUL = "paymentSuccessful"
    PREPARING_SHIPMENT = "preparingShipment"
    ITEM_DISPATCHED = "itemDispatched"
    ITEM_RECEIVED_BY_CUSTOMER = "itemReceivedByCustomer"
    DELIVERY_ISSUE = "deliveryIssue"
    RETURN_INITIATED_BY_CUSTOMER = "returnInitiatedByCustomer"
    ITEM_RECEIVED_BACK = "itemReceivedBack"
    REFUND_PROCESSED = "refundProcessed"
