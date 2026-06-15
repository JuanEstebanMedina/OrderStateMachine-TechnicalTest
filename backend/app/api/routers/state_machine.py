from fastapi import APIRouter

from app.dependencies import StateMachineDependency
from app.domain import OrderState
from app.schemas import StateMachineDefinitionResponse


router = APIRouter(tags=["state-machine"])


@router.get("/state-machine", response_model=StateMachineDefinitionResponse)
def get_state_machine_definition(
    state_machine: StateMachineDependency,
) -> StateMachineDefinitionResponse:
    return StateMachineDefinitionResponse(
        initial_state=OrderState.PENDING,
        states=list(OrderState),
        transitions=state_machine.get_transition_definitions(),
    )
