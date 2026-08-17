def test_touch_pacing_bypass(agent):
    answer = agent(
        "One rule paces how often the same player may play the ball again. "
        "Exactly one situation lets a player play it before that pacing "
        "would allow it. Which situation?",
        schema={
            "type": "object",
            "properties": {
                "situation": {
                    "enum": [
                        "the player nearest the ball on that step",
                        "the keyboard-driven player, when the held run "
                        "direction differs from the previous step",
                        "any player whose run direction changed since the "
                        "previous step",
                        "a player whose team played the ball last",
                        "the fastest player on the pitch",
                        "no situation",
                    ]
                },
            },
            "required": ["situation"],
        },
    )
    assert answer["situation"] == (
        "the keyboard-driven player, when the held run direction differs "
        "from the previous step"
    )


def test_first_touch_pace(agent):
    answer = agent(
        "A player who was not on the ball on the previous step reaches it "
        "and plays it. Which running pace is the push ahead of him worked "
        "out from?",
        schema={
            "type": "object",
            "properties": {
                "pace": {
                    "enum": [
                        "his free-running top pace",
                        "the reduced pace of a player carrying the ball",
                        "the average of the two",
                        "zero pace",
                    ]
                },
            },
            "required": ["pace"],
        },
    )
    assert answer["pace"] == "his free-running top pace"


def test_contact_uses_pre_move_positions(agent):
    answer = agent(
        "Within one simulation step of the match, is the test for whether a "
        "player is close enough to play the ball made on the player "
        "positions from the start of the step, or on the positions after "
        "that step's movement?",
        schema={
            "type": "object",
            "properties": {
                "positions": {
                    "enum": [
                        "the positions at the start of the step",
                        "the positions after that step's movement",
                        "the positions after movement and after bodies are "
                        "parted",
                        "the midpoint of both",
                    ]
                },
            },
            "required": ["positions"],
        },
    )
    assert answer["positions"] == "the positions at the start of the step"


def test_kick_needs_no_ownership(agent):
    answer = agent(
        "A player of the blue team is running with the ball. The keyboard is "
        "driving a player of the white team, who stands right beside that "
        "ball and releases the kick button with a wind-up already built up. "
        "Does the ball launch?",
        schema={
            "type": "object",
            "properties": {"launches": {"type": "boolean"}},
            "required": ["launches"],
        },
    )
    assert answer["launches"] is True
