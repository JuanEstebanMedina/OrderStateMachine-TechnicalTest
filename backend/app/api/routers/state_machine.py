from fastapi import APIRouter

from app.dependencies import StateMachineDependency
from app.domain import OrderState
from app.schemas import StateMachineDefinitionResponse, StateMachineTransitionResponse


router = APIRouter(tags=["state-machine"])


@router.get("/state-machine")
def get_state_machine_definition(
    state_machine: StateMachineDependency,
) -> StateMachineDefinitionResponse:
    return StateMachineDefinitionResponse(
        initialState=OrderState.PENDING,
        states=list(OrderState),
        transitions=[
            StateMachineTransitionResponse.model_validate(transition)
            for transition in state_machine.get_transition_definitions()
        ],
    )
