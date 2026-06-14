from typing import Annotated

from fastapi import APIRouter, Depends

from app.dependencies import get_state_machine
from app.domain import OrderState
from app.schemas import StateMachineDefinitionResponse
from app.services import OrderStateMachine


router = APIRouter(tags=["state-machine"])


@router.get("/state-machine", response_model=StateMachineDefinitionResponse)
def get_state_machine_definition(
    state_machine: Annotated[OrderStateMachine, Depends(get_state_machine)],
) -> StateMachineDefinitionResponse:
    return StateMachineDefinitionResponse(
        initial_state=OrderState.PENDING,
        states=list(OrderState),
        transitions=state_machine.get_transition_definitions(),
    )
