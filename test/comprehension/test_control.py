def test_keeper_chase_and_keyboard(agent):
    answer = agent(
        "Nobody has touched the ball for a while, and a goalkeeper can now "
        "reach the loose ball sooner than every team-mate. On that step, "
        "before anyone plays the ball, is the keyboard handed to him?",
        schema={
            "type": "object",
            "properties": {"handed": {"type": "boolean"}},
            "required": ["handed"],
        },
    )
    assert answer["handed"] is False


def test_switch_margin_is_load_bearing(agent):
    answer = agent(
        "One tuning number makes the keyboard wait until a team-mate is "
        "clearly better placed before it moves to him. If that number were "
        "set to zero, what fault would show?",
        schema={
            "type": "object",
            "properties": {
                "fault": {
                    "enum": [
                        "nothing would change",
                        "the keyboard would flip between two similar players "
                        "step after step",
                        "the keyboard would stop moving between players",
                        "the keyboard could move to an opponent",
                        "the driven player would stop answering the keys",
                    ]
                },
            },
            "required": ["fault"],
        },
    )
    assert answer["fault"] == (
        "the keyboard would flip between two similar players step after step"
    )


def test_charge_on_handover(agent):
    answer = agent(
        "The kick button is held down while the keyboard moves to another "
        "player of the same team. What happens to the wind-up built up so "
        "far?",
        schema={
            "type": "object",
            "properties": {
                "windUp": {
                    "enum": [
                        "it passes to the new player",
                        "it is thrown away and starts again from nothing",
                        "it stays with the old player until the button is "
                        "released",
                        "it fires a kick at once",
                        "it is halved",
                    ]
                },
            },
            "required": ["windUp"],
        },
    )
    assert answer["windUp"] == "it is thrown away and starts again from nothing"
